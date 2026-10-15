import { listOrdersProxy, submitOrderProxy } from "@/lib/oms-proxy";

export async function GET() { return listOrdersProxy(); }
export async function POST(request: Request) { return submitOrderProxy(request); }
