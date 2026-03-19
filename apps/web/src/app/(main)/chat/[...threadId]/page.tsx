import ThreadClient from "./thread-client";

export async function generateStaticParams() {
  return [{ threadId: ["_"] }];
}

export default function ThreadPage() {
  return <ThreadClient />;
}
