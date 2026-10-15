import { orderProxy } from "@/lib/oms-proxy";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  return orderProxy((await context.params).orderId);
}
