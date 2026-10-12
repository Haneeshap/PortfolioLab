
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type MarketPrice = {
  symbol: string;
  price: number;
  currency: string;
  updatedAt: string;
};

type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected";

type MarketPriceContextValue = {
  prices: MarketPrice[];
  status: ConnectionStatus;
};

const MarketPriceContext =
  createContext<MarketPriceContextValue | null>(null);

export function MarketPriceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [status, setStatus] =
    useState<ConnectionStatus>("connecting");

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer:
      | ReturnType<typeof setTimeout>
      | undefined;

    function connect() {
      if (!active) return;

      setStatus("connecting");

      socket = new WebSocket(
        "ws://localhost:8081/ws/prices"
      );

      socket.onopen = () => {
        if (active) setStatus("connected");
      };

      socket.onmessage = (event) => {
        if (!active) return;

        try {
          const data: unknown = JSON.parse(event.data);

          if (
            !Array.isArray(data) ||
            !data.every(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                typeof item.symbol === "string" &&
                typeof item.price === "number" &&
                Number.isFinite(item.price) &&
                item.price >= 0 &&
                typeof item.currency === "string" &&
                typeof item.updatedAt === "string"
            )
          ) {
            throw new Error("Invalid market price data");
          }

          setPrices(data as MarketPrice[]);
        } catch (error) {
          console.error(
            "Invalid market message:",
            error
          );
        }
      };

      socket.onerror = () => {
        if (active) setStatus("disconnected");
      };

      socket.onclose = () => {
        if (!active) return;

        setStatus("disconnected");

        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      active = false;

      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, []);

  return (
    <MarketPriceContext.Provider
      value={{ prices, status }}
    >
      {children}
    </MarketPriceContext.Provider>
  );
}

export function useMarketPrices() {
  const context = useContext(MarketPriceContext);

  if (!context) {
    throw new Error(
      "useMarketPrices must be used inside MarketPriceProvider"
    );
  }

  return context;
}
