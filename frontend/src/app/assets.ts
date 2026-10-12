export type Asset = {
  id: number;
  symbol: string;
  name: string;
  price: number;
  currency: string;
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
