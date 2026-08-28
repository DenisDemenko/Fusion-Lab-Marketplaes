import type { Curriculum } from "@fusion-lab/shared-types";

// The seller cabinet edits a course programme as plain text, not as JSON:
//
//   ## Модуль 1. Ескізи
//   1 заняття. Лінії та розміри
//   2 заняття. Обмеження
//
// A JSON textarea would be honest about the storage format and unusable by
// the people who actually write courses; a full drag-and-drop editor is a
// project of its own. This format is typed the way a programme is already
// written down, and it round-trips: parse(serialize(x)) === x.
export function parseCurriculumText(text: string): Curriculum | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const modules: NonNullable<Curriculum["modules"]> = [];

  for (const line of lines) {
    if (line.startsWith("##")) {
      modules.push({ title: line.replace(/^#+\s*/, ""), lessons: [] });
      continue;
    }

    // A lesson before any module heading still has to go somewhere, so it
    // opens an untitled module rather than being silently dropped.
    if (modules.length === 0) {
      modules.push({ title: "Програма", lessons: [] });
    }

    modules[modules.length - 1].lessons?.push({ title: line });
  }

  return { modules };
}

export function serializeCurriculum(curriculum: Curriculum | null): string {
  if (!curriculum?.modules?.length) return "";

  return curriculum.modules
    .map((module) =>
      [`## ${module.title}`, ...(module.lessons ?? []).map((lesson) => lesson.title)].join(
        "\n",
      ),
    )
    .join("\n\n");
}
