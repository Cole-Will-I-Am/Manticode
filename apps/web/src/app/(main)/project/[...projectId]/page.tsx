import ProjectClient from "./project-client";

export async function generateStaticParams() {
  return [{ projectId: ["_"] }];
}

export default function ProjectPage() {
  return <ProjectClient />;
}
