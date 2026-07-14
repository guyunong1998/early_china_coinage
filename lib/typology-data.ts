// AUTO-GENERATED from Typology.xlsx — do not edit manually
// Re-generate: node scripts/gen-typology.js

export type TypologyLeaf = {
  inscription_zh: string | null
  inscription_en: string | null
  mint_zh: string | null
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}

export type TypologyL4 = {
  label_en: string
  label_zh: string
  filter_key: string
}

export type TypologyL3 = {
  label_en: string
  label_zh: string
  type_key: string
  entries: TypologyLeaf[]
  children: TypologyL4[]
}

export type TypologyL2 = {
  label_en: string
  label_zh: string
  type_key?: string
  entries?: TypologyLeaf[]
  children: TypologyL3[]
}

export type TypologyL1 = {
  label_en: string
  label_zh: string
  /** Present when L1 is a leaf (no L2 children), e.g. Round Coin. */
  entries?: TypologyLeaf[]
  children: TypologyL2[]
}

export const TYPOLOGY: TypologyL1[] = [
  {
    "label_en": "Spade Coin",
    "label_zh": "布币",
    "children": [
      {
        "label_en": "Hollow-socket Spade",
        "label_zh": "空首布",
        "children": [
          {
            "label_en": "Flat-Shoulder Hollow-socket Spade",
            "label_zh": "平肩空首布",
            "type_key": "平肩空首布",
            "entries": [
              {
                "inscription_zh": null,
                "inscription_en": null,
                "mint_zh": null,
                "mint_en": null,
                "state_zh": "周",
                "state_en": "Zhou"
              }
            ],
            "children": [
              {
                "label_en": "Large",
                "label_zh": "大型平肩空首布",
                "filter_key": "大型平肩空首布"
              },
              {
                "label_en": "Small",
                "label_zh": "小型平肩空首布",
                "filter_key": "小型平肩空首布"
              }
            ]
          },
          {
            "label_en": "Slanted-Shoulder Hollow-Socket Spade",
            "label_zh": "斜肩空首布",
            "type_key": "斜肩空首布",
            "entries": [
              {
                "inscription_zh": null,
                "inscription_en": null,
                "mint_zh": null,
                "mint_en": null,
                "state_zh": "周",
                "state_en": "Zhou"
              }
            ],
            "children": []
          },
          {
            "label_en": "Pointed-Shoulder Hollow-Socket Spade",
            "label_zh": "尖肩空首布",
            "type_key": "尖肩空首布",
            "entries": [],
            "children": []
          }
        ]
      },
      {
        "label_en": "Flat-handle Spade",
        "label_zh": "平首布",
        "children": [
          {
            "label_en": "Pointed-Foot Spade Flat-handle Sapde",
            "label_zh": "尖足布",
            "type_key": "尖足布",
            "entries": [
              {
                "inscription_zh": "蔺",
                "inscription_en": "Lin",
                "mint_zh": "蔺",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "蔺半",
                "inscription_en": "Lin Ban",
                "mint_zh": "蔺",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "兹氏",
                "inscription_en": "Zishi",
                "mint_zh": "兹氏",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "兹氏半",
                "inscription_en": "Zishi Ban",
                "mint_zh": "兹氏",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "兹",
                "inscription_en": "Zi",
                "mint_zh": "兹氏",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "邪",
                "inscription_en": "Xie",
                "mint_zh": "邪",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "大阴",
                "inscription_en": "Da Yin",
                "mint_zh": "阴",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "大阴半",
                "inscription_en": "Da Yin Ban",
                "mint_zh": "阴",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "北兹釿",
                "inscription_en": "Bei Zi Jin",
                "mint_zh": "北兹",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "襄城",
                "inscription_en": "Xiangcheng",
                "mint_zh": "襄城",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "甘丹",
                "inscription_en": "Gandan",
                "mint_zh": "邯郸",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "晋阳",
                "inscription_en": "Jinyang",
                "mint_zh": "晋阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "晋阳半",
                "inscription_en": "Jinyang Ban",
                "mint_zh": "晋阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "阳曲",
                "inscription_en": "Yangqu",
                "mint_zh": "阳曲",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "阳邑",
                "inscription_en": "Yangyi",
                "mint_zh": "阳邑",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "虑虒",
                "inscription_en": "Lvsi",
                "mint_zh": "虑虒",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "虑虒半",
                "inscription_en": "Lvsi Ban",
                "mint_zh": "虑虒",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "虑半",
                "inscription_en": "Lv Ban",
                "mint_zh": "虑虒",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "榆即半",
                "inscription_en": "Yuji Ban",
                "mint_zh": "榆即",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "榆半",
                "inscription_en": "Yu Ban",
                "mint_zh": "榆即",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "武安",
                "inscription_en": "Wu'an",
                "mint_zh": "武安",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "武平",
                "inscription_en": "Wuping",
                "mint_zh": "武平",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "中阳",
                "inscription_en": "Zhongyang",
                "mint_zh": "中阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "西都",
                "inscription_en": "Xidu",
                "mint_zh": "西都",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "离石",
                "inscription_en": "Lishi",
                "mint_zh": "离石",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "新城",
                "inscription_en": "Xincheng",
                "mint_zh": "新城",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "亲城",
                "inscription_en": "Qincheng",
                "mint_zh": "新城",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "辛城",
                "inscription_en": "Xincheng",
                "mint_zh": "新城",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "于",
                "inscription_en": "Yu",
                "mint_zh": "盂",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "于半",
                "inscription_en": "Yu Ban",
                "mint_zh": "盂",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "大丌",
                "inscription_en": "Daji",
                "mint_zh": "箕",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "霍人",
                "inscription_en": "Huoren",
                "mint_zh": "霍人",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "襄平",
                "inscription_en": "Xiangping",
                "mint_zh": "襄平",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "平州",
                "inscription_en": "Pingzhou",
                "mint_zh": "平州",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "平匋",
                "inscription_en": "Pingtao",
                "mint_zh": "平陶",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "埒",
                "inscription_en": "Lie",
                "mint_zh": "埒",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "埒阳",
                "inscription_en": "Lie Yang",
                "mint_zh": "埒阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "寿阴",
                "inscription_en": "Shouyin",
                "mint_zh": "寿阴",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "博",
                "inscription_en": "Bo",
                "mint_zh": "博",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "日",
                "inscription_en": "Ri",
                "mint_zh": "日",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "繁寺",
                "inscription_en": "Fansi",
                "mint_zh": "繁峙",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "鄤仇",
                "inscription_en": "Manchou",
                "mint_zh": "鄤仇",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "娄弁",
                "inscription_en": "Loubian",
                "mint_zh": "娄弁",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "百阳",
                "inscription_en": "Baiyang",
                "mint_zh": "伯阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "安平",
                "inscription_en": "Anping",
                "mint_zh": "安平",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "善往",
                "inscription_en": "Shanwang",
                "mint_zh": "善无",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "椁",
                "inscription_en": "Guo",
                "mint_zh": "崞",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "若",
                "inscription_en": "Ruo",
                "mint_zh": "骆",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              }
            ],
            "children": [
              {
                "label_en": "Large",
                "label_zh": "大尖足布",
                "filter_key": "大尖足布"
              },
              {
                "label_en": "Small",
                "label_zh": "尖足布",
                "filter_key": "尖足布"
              }
            ]
          },
          {
            "label_en": "Square-foot Spade Flat-handle Sapde",
            "label_zh": "方足布",
            "type_key": "方足布",
            "entries": [
              {
                "inscription_zh": "蔺",
                "inscription_en": "Lin",
                "mint_zh": "蔺",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "代",
                "inscription_en": "Dai",
                "mint_zh": "代",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "中都",
                "inscription_en": "Zhongdu",
                "mint_zh": "中都",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "中邑",
                "inscription_en": "Zhongyi",
                "mint_zh": "中邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "长安",
                "inscription_en": "Chang'an",
                "mint_zh": "长安",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "祁",
                "inscription_en": "Qi",
                "mint_zh": "祁",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "安阳",
                "inscription_en": "Anyang",
                "mint_zh": "安阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "安阳邑",
                "inscription_en": "Anyang Yi",
                "mint_zh": "安阳邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "阳邑",
                "inscription_en": "Yangyi",
                "mint_zh": "阳邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "平备",
                "inscription_en": "Pingbei",
                "mint_zh": "平原",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "邸",
                "inscription_en": "Di",
                "mint_zh": "邸",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "土匀",
                "inscription_en": "Tuyun",
                "mint_zh": "土军",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "干关",
                "inscription_en": "Ganguan",
                "mint_zh": "干关",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "平阳",
                "inscription_en": "Pingyang",
                "mint_zh": "平阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "平阴",
                "inscription_en": "Pingyin",
                "mint_zh": "平阴",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "平于",
                "inscription_en": "Pingyu",
                "mint_zh": "平舒",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "邬",
                "inscription_en": "Wu",
                "mint_zh": "邬",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "北丌",
                "inscription_en": "Beiji",
                "mint_zh": "丌",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "唐是",
                "inscription_en": "Tangshi",
                "mint_zh": "杨氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "榆即",
                "inscription_en": "Yuji",
                "mint_zh": "榆即",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "贝丘",
                "inscription_en": "Beiqiu",
                "mint_zh": "榆即",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "平城",
                "inscription_en": "Pingcheng",
                "mint_zh": "平城",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "寿阴",
                "inscription_en": "Shouyin",
                "mint_zh": "寿阴",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "宜阳",
                "inscription_en": "Yiyang",
                "mint_zh": "宜阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "隰城",
                "inscription_en": "Xicheng",
                "mint_zh": "隰城",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "纶氏",
                "inscription_en": "Lunshi",
                "mint_zh": "纶氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "宅阳",
                "inscription_en": "Zhaiyang",
                "mint_zh": "宅阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "幵阳",
                "inscription_en": "Jian Yang",
                "mint_zh": "轵阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "阳城",
                "inscription_en": "Yangcheng",
                "mint_zh": "阳城",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "马雍",
                "inscription_en": "Mayong",
                "mint_zh": "马雍",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "洀",
                "inscription_en": "Zhou",
                "mint_zh": "洀",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "郲",
                "inscription_en": "Lai",
                "mint_zh": "郲",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "铸",
                "inscription_en": "Zhu",
                "mint_zh": "铸",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "彘",
                "inscription_en": "Zhi",
                "mint_zh": "彘",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "襄垣",
                "inscription_en": "Xiangyuan",
                "mint_zh": "襄垣",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "长子",
                "inscription_en": "Changzi",
                "mint_zh": "长子",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "尚子",
                "inscription_en": "Shangzi",
                "mint_zh": "长子",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "屯留",
                "inscription_en": "Tunliu",
                "mint_zh": "屯留",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "咎奴",
                "inscription_en": "Jiunu",
                "mint_zh": "咎奴",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "涅",
                "inscription_en": "Nie",
                "mint_zh": "涅",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "乌疋",
                "inscription_en": "Wupi",
                "mint_zh": "阏与",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "泫氏",
                "inscription_en": "Xuanshi",
                "mint_zh": "泫氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "皮氏",
                "inscription_en": "Pishi",
                "mint_zh": "皮氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "酉枣",
                "inscription_en": "Youzao",
                "mint_zh": "酸枣",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "奇氏",
                "inscription_en": "Qishi",
                "mint_zh": "猗氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "蒲子",
                "inscription_en": "Puzi",
                "mint_zh": "蒲子",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "梁邑",
                "inscription_en": "Liangyi",
                "mint_zh": "梁邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "高都",
                "inscription_en": "Gaodu",
                "mint_zh": "高都",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "潞",
                "inscription_en": "Lu",
                "mint_zh": "潞",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "渔阳",
                "inscription_en": "Yuyang",
                "mint_zh": "虞阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "邾",
                "inscription_en": "Lai",
                "mint_zh": "虒祁",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "向邑",
                "inscription_en": "Xiangyi",
                "mint_zh": "向",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "东周",
                "inscription_en": "Dongzhou",
                "mint_zh": "东周",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "留邑",
                "inscription_en": "Liuyi",
                "mint_zh": "留",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "怡",
                "inscription_en": "Yi",
                "mint_zh": "怡",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "鄫",
                "inscription_en": "Zeng",
                "mint_zh": "负邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "禾邑",
                "inscription_en": "Heyi",
                "mint_zh": "邧",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "冠阳",
                "inscription_en": "Guanyang",
                "mint_zh": "原阳",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "北寻",
                "inscription_en": "Beixun",
                "mint_zh": "北寻",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "郃",
                "inscription_en": "He",
                "mint_zh": "郐",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "贝邑",
                "inscription_en": "Beiyi",
                "mint_zh": "？",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "中亭",
                "inscription_en": "Zhongting",
                "mint_zh": "中亭",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "武邑",
                "inscription_en": "Wuyi",
                "mint_zh": "武邑",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "王氏",
                "inscription_en": "Wangshi",
                "mint_zh": "王氏",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "鄗",
                "inscription_en": "Hao",
                "mint_zh": "鄗",
                "mint_en": null,
                "state_zh": "三晋",
                "state_en": "San Jin"
              },
              {
                "inscription_zh": "燕安阳",
                "inscription_en": "Yan Anyang",
                "mint_zh": null,
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "榦刀",
                "inscription_en": "Handao",
                "mint_zh": "韩号",
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "襄平",
                "inscription_en": "Xiangping",
                "mint_zh": "襄平",
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "差阴",
                "inscription_en": "Chayin",
                "mint_zh": "坪阴",
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "益昌",
                "inscription_en": "Yichang",
                "mint_zh": "广昌",
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "右明司冶",
                "inscription_en": "Youming Siye",
                "mint_zh": null,
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              },
              {
                "inscription_zh": "宜平",
                "inscription_en": "Yiping",
                "mint_zh": "重平",
                "mint_en": null,
                "state_zh": "燕",
                "state_en": "Yan"
              }
            ],
            "children": [
              {
                "label_en": "Large",
                "label_zh": "大方足布",
                "filter_key": "大方足布"
              },
              {
                "label_en": "Small",
                "label_zh": "方足布",
                "filter_key": "方足布"
              }
            ]
          },
          {
            "label_en": "Round-foot Spade Flat-handle Sapde",
            "label_zh": "圆足布",
            "type_key": "圆足布",
            "entries": [
              {
                "inscription_zh": "蔺",
                "inscription_en": "Lin",
                "mint_zh": "蔺",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "离石",
                "inscription_en": "Lishi",
                "mint_zh": "离石",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              }
            ],
            "children": [
              {
                "label_en": "Large",
                "label_zh": "大圆足布",
                "filter_key": "大圆足布"
              },
              {
                "label_en": "Small",
                "label_zh": "圆足布",
                "filter_key": "圆足布"
              }
            ]
          },
          {
            "label_en": "Bridge-foot Spade Flat-handle Sapde",
            "label_zh": "桥足布",
            "type_key": "桥足布",
            "entries": [
              {
                "inscription_zh": "安邑一釿",
                "inscription_en": "Anyi Yijin",
                "mint_zh": "安邑",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "安邑二釿",
                "inscription_en": "Anyi Erjin",
                "mint_zh": "安邑",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "安邑半釿",
                "inscription_en": "Anyi Banjin",
                "mint_zh": "安邑",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "阴晋一釿",
                "inscription_en": "Yinjin Yijin",
                "mint_zh": "阴晋",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "阴晋半釿",
                "inscription_en": "Yinjin Banjin",
                "mint_zh": "阴晋",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "蒲反一釿",
                "inscription_en": "Pufan Yijin",
                "mint_zh": "蒲阪",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "蒲反半釿",
                "inscription_en": "Pufan Banjin",
                "mint_zh": "蒲阪",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "高奴一釿",
                "inscription_en": "Gaonu Yijin",
                "mint_zh": "高奴",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "言阳一釿",
                "inscription_en": "Yanyang Yijin",
                "mint_zh": "言阳",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "言阳二釿",
                "inscription_en": "Yanyang Erjin",
                "mint_zh": "言阳",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "言阳半釿",
                "inscription_en": "Yanyang Banjin",
                "mint_zh": "言阳",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "禾二釿",
                "inscription_en": "He Erjin",
                "mint_zh": "少梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "禾一釿",
                "inscription_en": "He Yijin",
                "mint_zh": "少梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "禾半釿",
                "inscription_en": "He Banjin",
                "mint_zh": "少梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "卢氏半釿",
                "inscription_en": "Lushi Banjin",
                "mint_zh": "卢氏",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "陕一釿",
                "inscription_en": "Shan Yijin",
                "mint_zh": "陕",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "陕半釿",
                "inscription_en": "Shan Banjin",
                "mint_zh": "陕",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "共半釿",
                "inscription_en": "Gong Banjin",
                "mint_zh": "共",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "泫氏半釿",
                "inscription_en": "Xuanshi Banjin",
                "mint_zh": "泫氏",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "魏一釿",
                "inscription_en": "Wei Yijin",
                "mint_zh": "魏",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "梁冢釿五十当寽",
                "inscription_en": "Liang Zhongjin Bai Dang Lv",
                "mint_zh": "大梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "梁正尚百当寽",
                "inscription_en": "Liang Zhengshang Bai Dang Lv",
                "mint_zh": "大梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "梁冢釿百当寽",
                "inscription_en": "Liang Zhongjin Wushi Dang LV",
                "mint_zh": "大梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "梁半尚二百当寽",
                "inscription_en": "Liang Banshang Erbai Dang Lv",
                "mint_zh": "大梁",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "山阳",
                "inscription_en": "Shanyang",
                "mint_zh": "山阳",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "安阴",
                "inscription_en": "Anyin",
                "mint_zh": "安阴",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "分布",
                "inscription_en": "Fen Bu",
                "mint_zh": "分",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "垣釿",
                "inscription_en": "Yuan Jin",
                "mint_zh": "垣",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              }
            ],
            "children": []
          },
          {
            "label_en": "Flat-Shoulder Flat-handle Sapde",
            "label_zh": "实首平肩布",
            "type_key": "实首平肩布",
            "entries": [],
            "children": []
          },
          {
            "label_en": "Three-hole Spade",
            "label_zh": "三孔布",
            "type_key": "三孔布",
            "entries": [
              {
                "inscription_zh": "南行阳",
                "inscription_en": "Nan Xingyang",
                "mint_zh": "南行唐",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "上𫟌",
                "inscription_en": "Shang'ai",
                "mint_zh": "上艾",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "北九门",
                "inscription_en": "Bei Jiumen",
                "mint_zh": "九门",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "宋子",
                "inscription_en": "Songzi",
                "mint_zh": "宋子",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "无终",
                "inscription_en": "Wuzhong",
                "mint_zh": "无终",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "阳湔",
                "inscription_en": "Yangjian",
                "mint_zh": "阳原",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "家阳",
                "inscription_en": "Jiayang",
                "mint_zh": "华阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "安阳",
                "inscription_en": "Anyang",
                "mint_zh": "安阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "安阴",
                "inscription_en": "Anyin",
                "mint_zh": "安阴",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "阿",
                "inscription_en": "e",
                "mint_zh": "葛",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "上曲阳",
                "inscription_en": "Shang Quyang",
                "mint_zh": "上曲阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "下曲阳",
                "inscription_en": "Xia Quyang",
                "mint_zh": "下曲阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "上博",
                "inscription_en": "Shangbo",
                "mint_zh": "上博",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "下博",
                "inscription_en": "Xiabo",
                "mint_zh": "下博",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "平台",
                "inscription_en": "Pingtai",
                "mint_zh": "平台",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              },
              {
                "inscription_zh": "疋阳",
                "inscription_en": "Piyang",
                "mint_zh": "疋阳",
                "mint_en": null,
                "state_zh": "赵",
                "state_en": "Zhao"
              }
            ],
            "children": []
          },
          {
            "label_en": "Sharp-cornered Spade",
            "label_zh": "锐角布",
            "type_key": "锐角布",
            "entries": [
              {
                "inscription_zh": "舟百涅",
                "inscription_en": "Zhou Bai Nie",
                "mint_zh": "州",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "百涅",
                "inscription_en": "Bail Nie",
                "mint_zh": null,
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "卢氏百涅",
                "inscription_en": "Lushi Bainie",
                "mint_zh": "卢氏",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "亳百涅",
                "inscription_en": "Bo Bainie",
                "mint_zh": "亳",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "公",
                "inscription_en": "Gong",
                "mint_zh": "浚",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              },
              {
                "inscription_zh": "魏",
                "inscription_en": "Wei",
                "mint_zh": "魏",
                "mint_en": null,
                "state_zh": "魏",
                "state_en": "Wei"
              }
            ],
            "children": [
              {
                "label_en": "Large",
                "label_zh": "大锐角布",
                "filter_key": "大锐角布"
              },
              {
                "label_en": "Small",
                "label_zh": "锐角布",
                "filter_key": "锐角布"
              }
            ]
          },
          {
            "label_en": "Swallow-tailed Spade",
            "label_zh": "燕尾布",
            "type_key": "燕尾布",
            "entries": [],
            "children": []
          },
          {
            "label_en": "Linked Spade",
            "label_zh": "连布",
            "type_key": "连布",
            "entries": [],
            "children": []
          }
        ]
      }
    ]
  },
  {
    "label_en": "Knife-Shaped Coin",
    "label_zh": "刀币",
    "children": [
      {
        "label_en": "Pointed-tip Knife",
        "label_zh": "尖首刀",
        "children": [],
        "type_key": "尖首刀",
        "entries": [
          {
            "inscription_zh": null,
            "inscription_en": null,
            "mint_zh": null,
            "mint_en": null,
            "state_zh": "燕",
            "state_en": "Yan"
          }
        ]
      },
      {
        "label_en": "Needle-tip Knife",
        "label_zh": "针首刀",
        "children": [],
        "type_key": "针首刀",
        "entries": []
      },
      {
        "label_en": "Ming Knife",
        "label_zh": "明刀",
        "children": [
          {
            "label_en": "Cuver back",
            "label_zh": "弧背明刀",
            "type_key": "弧背明刀",
            "entries": [],
            "children": []
          },
          {
            "label_en": "Straight back",
            "label_zh": "折背明刀",
            "type_key": "折背明刀",
            "entries": [],
            "children": []
          }
        ]
      },
      {
        "label_en": "Qi large Knife",
        "label_zh": "齐大刀",
        "children": [],
        "type_key": "齐大刀",
        "entries": []
      },
      {
        "label_en": "Qi-Ming Knife",
        "label_zh": "齐明刀",
        "children": [],
        "type_key": "齐明刀",
        "entries": [
          {
            "inscription_zh": null,
            "inscription_en": null,
            "mint_zh": null,
            "mint_en": null,
            "state_zh": "齐",
            "state_en": "Qi"
          }
        ]
      },
      {
        "label_en": "Straight-back Knife",
        "label_zh": "直刀",
        "children": [],
        "type_key": "直刀",
        "entries": []
      },
      {
        "label_en": "Primitive Large Knife",
        "label_zh": "原始大型刀币",
        "children": [],
        "type_key": "原始大型刀币",
        "entries": []
      }
    ]
  },
  {
    "label_en": "Round Coin",
    "label_zh": "圜钱",
    "children": []
  },
  {
    "label_en": "Ant-nose Coin",
    "label_zh": "蚁鼻钱",
    "children": []
  },
  {
    "label_en": "Gold Plate",
    "label_zh": "金版",
    "children": []
  }
]

export const ALL_MINTS: {
  mint_zh: string
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}[] = [
  {
    "mint_zh": "蔺",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "兹氏",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "邪",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "阴",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "北兹",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "襄城",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "邯郸",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "晋阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "阳曲",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "阳邑",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "虑虒",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "榆即",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "武安",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "武平",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "中阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "西都",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "离石",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "新城",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "盂",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "箕",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "霍人",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "襄平",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "平州",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "平陶",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "埒",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "埒阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "寿阴",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "博",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "日",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "繁峙",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "鄤仇",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "娄弁",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "伯阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "安平",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "善无",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "崞",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "骆",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "安邑",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "阴晋",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "蒲阪",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "高奴",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "言阳",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "少梁",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "卢氏",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "陕",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "共",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "泫氏",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "魏",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "大梁",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "山阳",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "安阴",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "分",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "垣",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "州",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "亳",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "浚",
    "mint_en": null,
    "state_zh": "魏",
    "state_en": "Wei"
  },
  {
    "mint_zh": "代",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "中都",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "中邑",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "长安",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "祁",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "安阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "安阳邑",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "平原",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "邸",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "土军",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "干关",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "平阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "平阴",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "平舒",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "邬",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "丌",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "杨氏",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "平城",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "宜阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "隰城",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "纶氏",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "宅阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "轵阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "阳城",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "马雍",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "洀",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "郲",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "铸",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "彘",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "襄垣",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "长子",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "屯留",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "咎奴",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "涅",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "阏与",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "皮氏",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "酸枣",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "猗氏",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "蒲子",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "梁邑",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "高都",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "潞",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "虞阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "虒祁",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "向",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "东周",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "留",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "怡",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "负邑",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "邧",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "原阳",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "北寻",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "郐",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "？",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "中亭",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "武邑",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "王氏",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "鄗",
    "mint_en": null,
    "state_zh": "三晋",
    "state_en": "San Jin"
  },
  {
    "mint_zh": "韩号",
    "mint_en": null,
    "state_zh": "燕",
    "state_en": "Yan"
  },
  {
    "mint_zh": "坪阴",
    "mint_en": null,
    "state_zh": "燕",
    "state_en": "Yan"
  },
  {
    "mint_zh": "广昌",
    "mint_en": null,
    "state_zh": "燕",
    "state_en": "Yan"
  },
  {
    "mint_zh": "重平",
    "mint_en": null,
    "state_zh": "燕",
    "state_en": "Yan"
  },
  {
    "mint_zh": "南行唐",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "上艾",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "九门",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "宋子",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "无终",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "阳原",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "华阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "葛",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "上曲阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "下曲阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "上博",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "下博",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "平台",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  },
  {
    "mint_zh": "疋阳",
    "mint_en": null,
    "state_zh": "赵",
    "state_en": "Zhao"
  }
]
