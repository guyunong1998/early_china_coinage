#!/usr/bin/env python3
"""
Generates a single poster-size PNG of the full coin_type_hierarchy tree
(both the 钱币 Coin branch and the 钱范 Coin Mould branch), fully expanded,
each node labeled bilingually (zh above, en below) above its obverse
specimen photo -- plus a JSON manifest of every node's pixel bounding box,
so the Next.js app can render both as an interactive pan/zoom "Typology
Viewer" (components/coin-types/TypologyViewer.tsx) with click-to-zoom.

Most hierarchy nodes don't have a photographed specimen (img_acc_num is
often null, or the file just isn't in public/images/type_imgs yet). For
those, this script borrows a stand-in image and renders it as a flat gray
silhouette (so it's visually obvious which nodes are real photos and which
are placeholders), in this priority order:

  1. a child/descendant's own photo
  2. the "parallel" mould <-> coin counterpart (every 钱范 label is its
     coin counterpart's label + "范", e.g. 圆足布范 <-> 圆足布) -- once
     *that* node is resolved (possibly itself via one of these same rules)
  3. the immediate parent type
  4. any sibling under the same parent

level1 nodes (钱币/钱范 themselves) are section headings only -- no photo
makes sense for an abstract category, so they get a bilingual title line
("钱币 · Coin" / "钱范 · Mould") and nothing else.

Output (see --out-dir below, default the repo's public/ directory -- this
diagram is actually served by the running app, unlike a one-off export):
  - images/coin-type-hierarchy.png   the full diagram, white background
  - data/coin-type-hierarchy.json    every node's zh/en label + pixel bbox
                                      in that PNG, for TypologyViewer's
                                      click-to-zoom and hover highlight

Intermediate per-node cutouts/silhouettes are written to a throwaway temp
directory (pass --debug-dir to inspect them instead) -- they're a build
step, not something the app or a person needs to look at normally.

Requirements: Pillow (`pip3 install pillow`) -- everything else is stdlib.
Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
.env.local (same as the app itself) to query coin_type_hierarchy directly
over the Supabase REST API.

Usage:
    python3 scripts/gen-coin-hierarchy-diagram.py
    python3 scripts/gen-coin-hierarchy-diagram.py --out-dir /tmp/preview --debug-dir /tmp/preview/debug

Rerun this whenever public/images/type_imgs gets new specimen photos, or
coin_type_hierarchy gains/loses rows -- everything is recomputed from
scratch each run (nothing here is incremental), and the two output files
are checked into the repo like any other static asset.
"""

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
from collections import deque

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError:
    sys.exit("Missing dependency: run `pip3 install pillow` and try again.")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(REPO_ROOT, "public/images/type_imgs")
ENV_FILE = os.path.join(REPO_ROOT, ".env.local")
LEVELS = ["level1_zh", "level2_zh", "level3_zh", "level4_zh", "level5_zh"]

# ── layout / rendering constants -- tweak here, not inline below ──────────
# Sized generously (vs. a print-only poster) since this now backs an
# in-browser pan/zoom viewer -- more native pixels per thumbnail means
# zooming in past 100% stays reasonably sharp before it visibly blurs.
MAX_THUMB_W, MAX_THUMB_H = 190, 230
LEAF_SPACING = 280
LEVEL_HEIGHT = 400
MARGIN = 90
SECTION_GAP = 150
SIL_COLOR = (107, 107, 107)
BG_THRESHOLD = 24  # background-removal color-distance cutoff, out of 255
CUTOUT_MAX_SIDE = 700

# Vertical offsets within one node's slot: zh label, then up to 2 lines of
# wrapped en label below it, then the thumbnail below that. Every node
# reserves the same 2-line height regardless of whether its own en label
# actually wraps, so thumbnail rows stay aligned across a level.
LABEL_ZH_OFFSET = 28
LABEL_EN_LINE_H = 21
BOX_TOP_OFFSET = LABEL_ZH_OFFSET + LABEL_EN_LINE_H * 2

# A connecting line ends at y + LINE_END_OFFSET (short, close to the row
# above), while the label/thumbnail content itself starts lower, at
# y + CONTENT_TOP_OFFSET -- the gap between those two is what keeps the
# lines from cutting through the text above them.
LINE_END_OFFSET = 14
CONTENT_TOP_OFFSET = 40

INK = (30, 28, 24)
MUTED = (130, 124, 114)
LINE_COLOR = (60, 60, 60)  # darker + thicker than the old (190,184,172)/2px --
LINE_WIDTH = 3             # explicitly asked to be "more visible"
PAGE_BG = (255, 255, 255)  # plain white, not the old off-white cream

# Candidate CJK-capable fonts, first one found wins. STHeiti/Hiragino/PingFang
# are macOS; Noto/WenQuanYi cover common Linux installs.
FONT_CANDIDATES = [
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]

# level1_zh only ever takes these two values in practice (see isMouldNode in
# lib/coin-type-catalog.ts) -- hardcoded rather than sourced from a column
# since coin_type_hierarchy has no level1_en field of its own to read.
LEVEL1_EN = {"钱币": "Coin", "钱范": "Mould"}


# ── 0. env + Supabase fetch ────────────────────────────────────────────────

def load_env_local():
    env = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_hierarchy_rows():
    env = load_env_local()
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (checked .env.local and the environment).")

    endpoint = f"{url}/rest/v1/coin_type_hierarchy?select=*&order=level1_zh,level2_zh,level3_zh,level4_zh,level5_zh&limit=1000"
    req = urllib.request.Request(endpoint, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req) as resp:
        rows = json.load(resp)
    print(f"fetched {len(rows)} coin_type_hierarchy rows")
    return rows


# ── 1. build the tree (level1 never appears as its own row -- only as a
# field embedded in deeper rows -- so synthesize a virtual root per distinct
# level1_zh value) ─────────────────────────────────────────────────────────

def find_obv(acc_num, files):
    if not acc_num:
        return None
    prefix = f"{acc_num}.obv".lower()
    for f in files:
        if f.lower().startswith(prefix):
            return os.path.join(IMG_DIR, f)
    return None


def build_tree(rows):
    files = os.listdir(IMG_DIR)
    nodes = {}
    by_path = {}

    level1_values = []
    for row in rows:
        v = row.get("level1_zh")
        if v and v not in level1_values:
            level1_values.append(v)
    for v in level1_values:
        nid = f"root::{v}"
        nodes[nid] = {
            "id": nid, "path": (v,), "level": 1, "label": v,
            "label_en": LEVEL1_EN.get(v, v),
            "own_image": None, "children": [], "parent": None,
        }
        by_path[(v,)] = nid

    for row in rows:
        path = []
        for lvl in LEVELS:
            v = row.get(lvl)
            if v is None:
                break
            path.append(v)
        path = tuple(path)
        nid = row["id"]
        en_key = f"level{len(path)}_en"
        nodes[nid] = {
            "id": nid, "path": path, "level": len(path), "label": path[-1],
            "label_en": row.get(en_key) or path[-1],
            "own_image": find_obv(row.get("img_acc_num"), files),
            "children": [], "parent": None,
        }
        by_path[path] = nid

    for nid, node in nodes.items():
        if len(node["path"]) <= 1:
            continue
        parent_id = by_path.get(node["path"][:-1])
        if parent_id:
            node["parent"] = parent_id
            nodes[parent_id]["children"].append(nid)

    return nodes


# ── 2. resolve each node's image: its own, or a borrowed stand-in ─────────

def mirror_id(nodes, nid):
    """钱范 (mould) <-> 钱币 (coin) are structural mirrors: every mould label
    is the coin label + '范'. Maps a node to its counterpart node's id."""
    path = nodes[nid]["path"]
    if path[0] == "钱范":
        mp = ("钱币",) + tuple(seg[:-1] if seg.endswith("范") else seg for seg in path[1:])
    elif path[0] == "钱币":
        mp = ("钱范",) + tuple(seg + "范" for seg in path[1:])
    else:
        return None
    for other_id, n in nodes.items():
        if n["path"] == mp:
            return other_id
    return None


def descendant_own_image(nodes, nid):
    """BFS over the subtree (children first) for the first descendant with
    its own image -- doesn't depend on anything else being resolved yet."""
    q = deque(nodes[nid]["children"])
    while q:
        cur = q.popleft()
        if nodes[cur]["own_image"]:
            return (nodes[cur]["own_image"], cur)
        q.extend(nodes[cur]["children"])
    return None


def resolve_images(nodes):
    """Iterative fixed-point propagation, NOT recursive backtracking -- with
    ~10-wide sibling groups on both sides of the mould/coin mirror, a naive
    recursive search over "try every sibling, which tries every one of
    *its* siblings..." blows up combinatorially. This just keeps growing a
    `resolved` dict from whatever's already known until nothing changes."""
    mirror = {nid: mirror_id(nodes, nid) for nid in nodes}
    resolved = {}
    for nid, n in nodes.items():
        if n["own_image"]:
            resolved[nid] = (n["own_image"], True, nid)

    changed = True
    while changed:
        changed = False
        for nid in nodes:
            if nid in resolved:
                continue
            d = descendant_own_image(nodes, nid)
            if d:
                resolved[nid] = (d[0], False, d[1])
                changed = True
                continue
            m = mirror.get(nid)
            if m and m in resolved:
                resolved[nid] = (resolved[m][0], False, resolved[m][2])
                changed = True
                continue
            parent = nodes[nid]["parent"]
            if parent and parent in resolved:
                resolved[nid] = (resolved[parent][0], False, resolved[parent][2])
                changed = True
                continue
            if parent:
                for sib in nodes[parent]["children"]:
                    if sib != nid and sib in resolved:
                        resolved[nid] = (resolved[sib][0], False, resolved[sib][2])
                        changed = True
                        break

    # global fallback for any stragglers (shouldn't be needed in practice)
    any_real = next((n["id"] for n in nodes.values() if n["own_image"]), None)
    for nid in nodes:
        if nid not in resolved and any_real:
            resolved[nid] = (nodes[any_real]["own_image"], False, any_real)

    own_n = sum(1 for _, is_own, _ in resolved.values() if is_own)
    print(f"resolved {len(resolved)} nodes: {own_n} with their own photo, {len(resolved) - own_n} need a silhouette")
    return resolved


# ── 3. generate the transparent color cutouts + gray silhouettes ──────────

def cutout_mask(im):
    """These source photos are already background-removed to a uniform
    black or white -- distance-from-corner-color beyond a threshold,
    softened a touch for anti-aliased edges."""
    im = im.convert("RGB")
    bg = im.getpixel((0, 0))
    bg_layer = Image.new("RGB", im.size, bg)
    diff = ImageChops.difference(im, bg_layer).convert("L")
    mask = diff.point(lambda x: 255 if x > BG_THRESHOLD else 0)
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    return im, mask.filter(ImageFilter.GaussianBlur(1.5))


def tight_crop(im, mask, pad_frac=0.04):
    bbox = mask.getbbox()
    if not bbox:
        return im, mask
    x0, y0, x1, y1 = bbox
    pad = int(max(x1 - x0, y1 - y0) * pad_frac)
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1)), mask.crop((x0, y0, x1, y1))


def downscale(im, max_side):
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    return im


def slugify_path(path):
    return re.sub(r"[^\w一-鿿-]", "_", "_".join(path))


def generate_images(nodes, resolved, cutout_dir, sil_dir):
    os.makedirs(cutout_dir, exist_ok=True)
    os.makedirs(sil_dir, exist_ok=True)

    real_sources = {}
    for nid, n in nodes.items():
        if n["own_image"]:
            im = Image.open(n["own_image"])
            im, mask = cutout_mask(im)
            im, mask = tight_crop(im, mask)
            rgba = im.convert("RGBA")
            rgba.putalpha(mask)
            rgba = downscale(rgba, CUTOUT_MAX_SIDE)
            out = os.path.join(cutout_dir, f"{slugify_path(n['path'])}.png")
            rgba.save(out)
            real_sources[nid] = out
    print(f"generated {len(real_sources)} photo cutouts -> {cutout_dir}")

    node_image = {}
    sil_count = 0
    for nid, (path, is_own, _src) in resolved.items():
        if is_own:
            node_image[nid] = real_sources[nid]
            continue
        im = Image.open(path)
        im, mask = cutout_mask(im)
        _, mask = tight_crop(im, mask)
        flat = Image.new("RGBA", mask.size, SIL_COLOR + (0,))
        flat.putalpha(mask)
        flat = downscale(flat, CUTOUT_MAX_SIDE)
        out = os.path.join(sil_dir, f"{slugify_path(nodes[nid]['path'])}.png")
        flat.save(out)
        node_image[nid] = out
        sil_count += 1
    print(f"generated {sil_count} silhouettes -> {sil_dir}")
    return node_image


# ── 4. layout + render the composite poster ────────────────────────────────

def load_font():
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    print("WARNING: no CJK font found -- Chinese labels will render as boxes.", file=sys.stderr)
    return None


def max_depth(nodes, nid):
    n = nodes[nid]
    return n["level"] if not n["children"] else max(max_depth(nodes, c) for c in n["children"])


def compute_layout(nodes, root_id, x0, y0):
    counter = [0]
    pos = {}

    def assign(nid):
        n = nodes[nid]
        if not n["children"]:
            x = x0 + counter[0] * LEAF_SPACING
            counter[0] += 1
        else:
            xs = [assign(c) for c in n["children"]]
            x = sum(xs) / len(xs)
        pos[nid] = (x, y0 + (n["level"] - 1) * LEVEL_HEIGHT)
        return x

    assign(root_id)
    return pos, counter[0] * LEAF_SPACING


def render(nodes, resolved, node_image, png_path, json_path):
    font_path = load_font()
    def font(size):
        return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default()

    font_label, font_label_en = font(24), font(16)
    font_section, font_small = font(52), font(18)

    def wrap_en(draw_, text, f, max_width, max_lines=2):
        """Greedy word-wrap to at most `max_lines` -- long compound labels
        (e.g. "Flat-handle Solid-head Spade") would otherwise overlap their
        neighbors at LEAF_SPACING width. Whatever's left once `max_lines-1`
        lines are filled becomes the final line as-is, even if still too
        wide, rather than truncating it unreadably."""
        words = text.split(" ")
        lines, cur, i = [], [], 0
        while i < len(words) and len(lines) < max_lines - 1:
            cur.append(words[i])
            trial = " ".join(cur)
            if len(cur) == 1 or draw_.textbbox((0, 0), trial, font=f)[2] <= max_width:
                i += 1
            else:
                cur.pop()
                lines.append(" ".join(cur))
                cur = []
        lines.append(" ".join(cur + words[i:]))
        return lines[:max_lines]

    roots = [nid for nid, n in nodes.items() if n["level"] == 1]
    roots.sort(key=lambda r: 0 if nodes[r]["label"] == "钱币" else 1)

    layouts = []
    cursor_y = MARGIN
    for r in roots:
        depth = max_depth(nodes, r)
        pos, width = compute_layout(nodes, r, 0, cursor_y + 100)
        layouts.append({"root": r, "pos": pos, "width": width, "top": cursor_y})
        cursor_y += 100 + depth * LEVEL_HEIGHT + SECTION_GAP

    canvas_w = max(l["width"] for l in layouts) + MARGIN * 2
    canvas_h = cursor_y + MARGIN

    for l in layouts:
        offset = (canvas_w - l["width"]) / 2
        l["pos"] = {nid: (x + offset, y) for nid, (x, y) in l["pos"].items()}

    img = Image.new("RGB", (int(canvas_w), int(canvas_h)), PAGE_BG)
    draw = ImageDraw.Draw(img)
    manifest = []

    def text_center(xy, text, f, fill):
        x, y = xy
        bbox = draw.textbbox((0, 0), text, font=f)
        draw.text((x - (bbox[2] - bbox[0]) / 2, y), text, font=f, fill=fill)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]

    for l in layouts:
        pos = l["pos"]
        root_label = f"{nodes[l['root']]['label']} · {nodes[l['root']]['label_en']}"
        text_center((canvas_w / 2, l["top"]), root_label, font_section, INK)

        xs = [x for x, _ in pos.values()]
        manifest.append({
            "id": l["root"], "level": 1, "labelZh": nodes[l["root"]]["label"],
            "labelEn": nodes[l["root"]]["label_en"],
            "bbox": [min(xs) - MAX_THUMB_W, l["top"] - 6,
                     max(xs) + MAX_THUMB_W, l["top"] + 100 + max_depth(nodes, l["root"]) * LEVEL_HEIGHT],
        })

        # connecting lines first, so node photos paint over any overlap at
        # the joins rather than lines drawing on top of them. Nothing is
        # drawn from the root (钱币/钱范) down to its own immediate
        # children -- that first link is visual noise once the root is just
        # a section heading with no card of its own.
        for nid, (x, y) in pos.items():
            parent = nodes[nid]["parent"]
            if parent and parent in pos and nodes[parent]["level"] != 1:
                px, py = pos[parent]
                parent_bottom = py + CONTENT_TOP_OFFSET + BOX_TOP_OFFSET + MAX_THUMB_H + 6
                child_top = y + LINE_END_OFFSET
                mid_y = (parent_bottom + child_top) / 2
                draw.line([(px, parent_bottom), (px, mid_y)], fill=LINE_COLOR, width=LINE_WIDTH)
                draw.line([(px, mid_y), (x, mid_y)], fill=LINE_COLOR, width=LINE_WIDTH)
                draw.line([(x, mid_y), (x, child_top)], fill=LINE_COLOR, width=LINE_WIDTH)

        for nid, (x, y) in pos.items():
            n = nodes[nid]
            if n["level"] == 1:
                continue  # section title above already covers roots -- no card, no photo
            is_own = resolved[nid][1]
            content_y = y + CONTENT_TOP_OFFSET

            text_center((x, content_y), n["label"], font_label, INK if is_own else MUTED)
            for line_i, line in enumerate(wrap_en(draw, n["label_en"], font_label_en, LEAF_SPACING - 14)):
                text_center((x, content_y + LABEL_ZH_OFFSET + line_i * LABEL_EN_LINE_H), line, font_label_en, MUTED)

            thumb = Image.open(node_image[nid]).convert("RGBA")
            scale = min(MAX_THUMB_W / thumb.width, MAX_THUMB_H / thumb.height, 1.0)
            tw, th = max(1, int(thumb.width * scale)), max(1, int(thumb.height * scale))
            thumb = thumb.resize((tw, th), Image.LANCZOS)

            box_top = content_y + BOX_TOP_OFFSET
            box_left, box_right = x - MAX_THUMB_W / 2, x + MAX_THUMB_W / 2
            box_bottom = box_top + MAX_THUMB_H
            img.paste(thumb, (int(x - tw / 2), int(box_top + (MAX_THUMB_H - th) / 2)), thumb)

            pad = 10
            manifest.append({
                "id": nid, "level": n["level"], "labelZh": n["label"], "labelEn": n["label_en"],
                "path": list(n["path"]), "hasOwnPhoto": is_own,
                "bbox": [box_left - pad, content_y - LABEL_ZH_OFFSET - 4, box_right + pad, box_bottom + pad],
            })

    lx, ly = MARGIN, canvas_h - 46
    draw.rectangle([lx, ly, lx + 16, ly + 16], fill=(120, 120, 120))
    draw.text((lx + 24, ly - 2), "= silhouette placeholder (borrowed shape, no photo for this exact type)",
               font=font_small, fill=MUTED)

    os.makedirs(os.path.dirname(png_path), exist_ok=True)
    img.save(png_path)
    print(f"saved {png_path} ({img.size[0]}x{img.size[1]})")

    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"width": img.size[0], "height": img.size[1], "nodes": manifest}, f, ensure_ascii=False, indent=1)
    print(f"saved {json_path} ({len(manifest)} node entries)")


# ── main ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--out-dir", default=os.path.join(REPO_ROOT, "public"),
        help="Base directory the app serves as static assets (default: the repo's public/ dir). "
             "Writes <out-dir>/images/coin-type-hierarchy.png and <out-dir>/data/coin-type-hierarchy.json.",
    )
    parser.add_argument(
        "--debug-dir", default=None,
        help="Optional directory to keep the intermediate photo-cutouts/ and silhouettes/ in "
             "(default: a throwaway temp directory, deleted after the run).",
    )
    args = parser.parse_args()

    out_dir = os.path.expanduser(args.out_dir)
    png_path = os.path.join(out_dir, "images", "coin-type-hierarchy.png")
    json_path = os.path.join(out_dir, "data", "coin-type-hierarchy.json")

    debug_dir = os.path.expanduser(args.debug_dir) if args.debug_dir else tempfile.mkdtemp(prefix="coin-hierarchy-")
    cutout_dir = os.path.join(debug_dir, "photo-cutouts")
    sil_dir = os.path.join(debug_dir, "silhouettes")

    rows = fetch_hierarchy_rows()
    nodes = build_tree(rows)
    resolved = resolve_images(nodes)
    node_image = generate_images(nodes, resolved, cutout_dir, sil_dir)
    render(nodes, resolved, node_image, png_path, json_path)

    if not args.debug_dir:
        shutil.rmtree(debug_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
