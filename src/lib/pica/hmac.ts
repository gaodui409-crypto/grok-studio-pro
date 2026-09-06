async function hmacHex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signRequest(path: string, method: string, time: string): Promise<string> {
  const API_KEY = "C69BAF41DA5ABD1FFEDC6D2FEA56B";
  const NONCE = "ptxdhmjzqtnrtwndhbxcpkjamb33w837";
  const DIGEST_KEY = "~d}$Q7$eIni=V)9\\RK/P.RM4;9[7|@/CA}b~OW!3?EV`:<>M7pddUBL5n|0/*Cn";

  const data = `${path}${time}${NONCE}${method}${API_KEY}`.toLowerCase();
  return hmacHex(DIGEST_KEY, data);
}
