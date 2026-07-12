import { DataCard } from '@/components/ui/DataCard'

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-3xl font-semibold text-brand">About</h1>
      <p className="mt-4 text-gray-700 leading-7">
        The Early Chinese Coin Finds Database catalogues archaeological discoveries of pre-Qin
        to early Han coinage across China. Each record links a find site to its geographic
        location, archaeological context, coin typology, and bibliographic sources.
      </p>

      <div className="mt-8 space-y-6">
        <DataCard title="Scope">
          <p className="text-sm leading-7 text-gray-700">
            The database covers knife coins, round coins, spade coins, and related types from
            validated publication records. Sites are georeferenced where possible and summarized
            by major and minor typology, inscriptions, mints, and issuing states.
          </p>
        </DataCard>

        <DataCard title="Team" id="team">
          <p className="text-sm leading-7 text-gray-700">
            This project is maintained by researchers working on early Chinese numismatics and
            archaeological publication. Team details can be added here.
          </p>
        </DataCard>

        <DataCard title="Collaborations" id="collaborations">
          <p className="text-sm leading-7 text-gray-700">
            We welcome collaboration with museums, excavation teams, and publication projects.
            Contact information and partner institutions can be listed in this section.
          </p>
        </DataCard>
      </div>
    </div>
  )
}
