
type Agent = {
  name: string;
  category: string;
  description: string;
  capabilities: string[];
  icon: string;
};

const agents: Agent[] = [
  {
    name: "Dividend Agent",
    category: "Corporate Actions",
    description:
      "Analyze fictional dividend announcements, estimate eligible payouts, and explain how dividend income is calculated.",
    capabilities: [
      "Dividend eligibility analysis",
      "Estimated payout calculations",
      "Dividend event explanations"
    ],
    icon: "₹"
  },
  {
    name: "Bonus Agent",
    category: "Corporate Actions",
    description:
      "Simulate bonus share issues, calculate additional shares, and explain the effects on simulated holdings.",
    capabilities: [
      "Bonus ratio calculations",
      "Additional share simulations",
      "Post-bonus holdings preview"
    ],
    icon: "+"
  },
  {
    name: "Business Rules Agent",
    category: "Validation & Compliance",
    description:
      "Explain and evaluate predefined business rules for simulated portfolio operations and corporate actions.",
    capabilities: [
      "Business rule validation",
      "Eligibility checks",
      "Explainable validation results"
    ],
    icon: "✓"
  }
];

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            AI WORKSPACE
          </span>

          <span className="text-xs text-slate-500">
            Read-only simulation
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Specialized AI Agents
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Dedicated assistants for simulated corporate actions,
            portfolio analysis, and business rule validation.
            These workflows are being developed separately from
            the general Ask AI chatbot.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article
            key={agent.name}
            className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400">
                {agent.icon}
              </div>

              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                Planned
              </span>
            </div>

            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
              {agent.category}
            </p>

            <h3 className="mt-2 text-lg font-semibold text-white">
              {agent.name}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              {agent.description}
            </p>

            <div className="mt-6 border-t border-slate-800 pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Planned capabilities
              </p>

              <ul className="space-y-3">
                {agent.capabilities.map((capability) => (
                  <li
                    key={capability}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <span className="text-emerald-400">✓</span>
                    <span>{capability}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto pt-7">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-center text-sm font-medium text-slate-400">
                Coming Soon
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xl text-emerald-400">
            ✓
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Controlled, read-only simulations
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              The planned agents will retrieve authorized simulation
              data and explain calculations or validation results.
              They will not place trades, modify holdings, or apply
              corporate actions automatically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
