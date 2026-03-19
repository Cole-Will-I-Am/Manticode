import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;

if (proxyUrl) {
  // Extract just the http://host:port part (strip auth if complex)
  try {
    const agent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(agent);
    console.log(`Proxy configured: ${new URL(proxyUrl).host}`);
  } catch (err) {
    console.warn("Failed to configure proxy:", err);
  }
}
