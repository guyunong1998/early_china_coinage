import { T } from '@/components/i18n/T'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-brand/20 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
        <p>
          <T k="footer.title" />
        </p>
        <p>
          <T k="footer.mapCredit" />
        </p>
      </div>
    </footer>
  )
}
