export type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
};

export type AssetSearchResult = {
  assetId: number;
  symbol: string;
  name: string;
  sector: string | null;
  description: string | null;
  similarity: number;
};

export async function getAssets(): Promise<Asset[]> {
  const response = await fetch(
    "http://127.0.0.1:8080/api/assets",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to retrieve assets from Spring Boot");
  }

  return response.json();
}

export async function searchAssetsSemantic(
  query: string,
  limit = 5
): Promise<AssetSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`/api/search/semantic?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to run semantic asset search");
  }

  return response.json();
}

