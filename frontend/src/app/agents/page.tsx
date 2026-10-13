import DividendAgent from "@/components/DividendAgent";
import BonusAgent from "@/components/BonusAgent";
import BusinessRulesAgent from "@/components/BusinessRulesAgent";

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            AGENT WORKSPACE
          </span>

          <span className="text-xs text-slate-500">
            Read-only simulation
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Specialized Agents
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Tool-backed workflows for simulated corporate actions
            and stock-market rule evaluations. These agents use
            predefined calculations and market-rule checks rather
            than autonomous AI decision-making.
          </p>
        </div>
      </section>

      <DividendAgent />

      <BonusAgent />

      <BusinessRulesAgent />

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <h3 className="font-semibold text-white">
          Controlled, read-only simulations
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          The Dividend Agent calculates hypothetical payouts.
          The Bonus Agent calculates hypothetical additional shares
          and post-bonus totals. The Business Rules Agent evaluates
          simulated BUY and SELL transactions against supplied
          market-specific rules for NSE, BSE, NYSE, and Nasdaq.
          None of these agents places trades, modifies holdings,
          or verifies live exchange approval.
        </p>
      </section>
    </div>
  );
}