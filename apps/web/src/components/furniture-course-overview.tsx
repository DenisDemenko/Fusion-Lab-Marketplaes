import { Link } from "@/i18n/navigation";

type Props = {
  en: boolean;
  title: string;
  cover: string | null;
  price: string;
  modules: { title: string; lessons: string[] }[];
};

// Public presentation only: no lesson URLs, paid assets or author controls.
export function FurnitureCourseOverview({
  en,
  title,
  cover,
  price,
  modules,
}: Props) {
  const detail = "/catalog/furniture-makers";
  const copy = en
    ? {
        tag: "FUSION LAB · FURNITURE & INTERIORS",
        title: "Fusion for furniture makers",
        intro:
          "From the first sketch to a furniture project. Explore modelling, visualisation and the drawings your workshop needs.",
        programme: "Explore the programme",
        details: "Course details & enrolment",
        results: "What you will learn",
        stats: ["modules", "lessons", "export formats"],
        outcomes: [
          [
            "Design the whole project",
            "Build furniture from a 2D sketch to a detailed 3D model.",
          ],
          [
            "Prepare clear drawings",
            "Create dimensions and documentation for your design.",
          ],
          [
            "Prepare manufacturing files",
            "Explore PDF, DXF and DWG export for the next production step.",
          ],
        ],
        audience: "Who this course is for",
        people: [
          [
            "Furniture designers",
            "Turn your ideas into detailed models and present them to clients.",
          ],
          [
            "Design engineers",
            "Use parameters, components and assemblies to develop a repeatable workflow.",
          ],
          [
            "Workshop owners",
            "Connect design decisions with the needs of your production team.",
          ],
        ],
        path: "Your path from sketch to production",
        pathIntro:
          "Start with the shape, connect its dimensions, then prepare the presentation and drawings.",
        steps: [
          [
            "2D sketches",
            "Geometry, constraints and dimensions: build an accurate foundation.",
          ],
          [
            "3D forms",
            "Extrude, Revolve, Loft and Sweep: turn sketches into furniture parts.",
          ],
          [
            "Parametric modelling",
            "Parameters, components and joints: adapt a design to new dimensions.",
          ],
          [
            "Visualisation",
            "Materials, textures and rendering: show how the finished piece will look.",
          ],
          [
            "Production documentation",
            "Drawings and PDF / DXF / DWG exports: communicate your design.",
          ],
        ],
        learning: "Learn through a project of your own",
        methods: [
          [
            "Recall before replaying",
            "After a lesson, explain the steps in your own words and try them without the video.",
          ],
          [
            "Return to the material",
            "Revisit an earlier exercise after a break and apply it to a different part.",
          ],
          [
            "Practise a little at a time",
            "Choose a manageable daily session and finish one concrete task.",
          ],
          [
            "Combine words and images",
            "Pair a sketch or screenshot with your own short explanation.",
          ],
          [
            "Work in small steps",
            "Split a complex model into a few operations and check each result.",
          ],
          [
            "Leave room for rest",
            "Take breaks and return to difficult steps with fresh attention.",
          ],
        ],
        motivation: "Choose a project you want to make",
        motivationText:
          "A shelf, a table or a cabinet: give each new tool a purpose in your own furniture project. Keep a record of what you can already do and what you want to practise next.",
        full: "Full course programme",
        module: "Module",
        lessons: "lessons",
        empty: "The detailed programme is being prepared.",
        cta: "Your first sketch is the beginning",
        ctaText:
          "Review the course details and enrol when you are ready to start.",
        access:
          "Course videos are available to students after payment. Student access does not include editing the course.",
        library: "Already enrolled? Open your library",
        price: "Current course price",
      }
    : {
        tag: "FUSION LAB · МЕБЛІ ТА ІНТЕР’ЄР",
        title,
        intro:
          "Від першого ескізу до проєкту меблів. Опануйте моделювання, візуалізацію та підготовку креслень для майстерні.",
        programme: "Переглянути програму",
        details: "Деталі та запис на курс",
        results: "Що ви отримаєте",
        stats: ["модулів", "занять", "формати експорту"],
        outcomes: [
          [
            "Повний цикл проєктування",
            "Від 2D-ескізу до деталізованої об’ємної моделі меблів.",
          ],
          [
            "Підготовка креслень",
            "Розміри, позначення та технічна документація вашого виробу.",
          ],
          [
            "Експорт для виробництва",
            "PDF, DXF та DWG для наступних етапів роботи над виробом.",
          ],
        ],
        audience: "Для кого цей курс",
        people: [
          [
            "Дизайнери меблів",
            "Перетворюйте ідеї на деталізовані моделі та презентуйте їх замовникам.",
          ],
          [
            "Конструктори",
            "Працюйте з параметрами, компонентами та складанням у єдиному процесі.",
          ],
          [
            "Власники виробництв",
            "Поєднуйте проєктування з практичними потребами своєї майстерні.",
          ],
        ],
        path: "Від ескізу до виробництва",
        pathIntro:
          "Спочатку форма, потім взаємозв’язок розмірів, візуалізація та документація.",
        steps: [
          [
            "Скетчі · 2D",
            "Геометрія, прив’язки та розміри: точна основа майбутнього виробу.",
          ],
          [
            "3D-форми",
            "Extrude, Revolve, Loft та Sweep: перетворення ескізів на деталі меблів.",
          ],
          [
            "Параметричне моделювання",
            "Параметри, компоненти та з’єднання: адаптація виробу під нові розміри.",
          ],
          [
            "Візуалізація",
            "Матеріали, текстури й рендер: покажіть, як виглядатиме готовий виріб.",
          ],
          [
            "Виробнича документація",
            "Креслення та експорт PDF / DXF / DWG: передайте задум у майстерню.",
          ],
        ],
        learning: "Навчайтеся на власному проєкті",
        methods: [
          [
            "Згадайте перед повторним переглядом",
            "Після уроку поясніть послідовність своїми словами й спробуйте виконати її без відео.",
          ],
          [
            "Повертайтеся до вивченого",
            "Повторіть попередню вправу після перерви та застосуйте її до іншої деталі.",
          ],
          [
            "Практикуйте потроху",
            "Оберіть посильний щоденний час і завершуйте одну конкретну задачу.",
          ],
          [
            "Поєднуйте слова й зображення",
            "Доповнюйте ескіз або скриншот власним коротким поясненням.",
          ],
          [
            "Рухайтеся невеликими кроками",
            "Розділіть складну модель на кілька операцій і перевіряйте кожен результат.",
          ],
          [
            "Залишайте час на відпочинок",
            "Робіть перерви й повертайтеся до складних кроків зі свіжою увагою.",
          ],
        ],
        motivation: "Оберіть виріб, який хочете створити",
        motivationText:
          "Полиця, стіл чи шафа — нехай кожен новий інструмент працює на ваш власний проєкт. Фіксуйте, що вже вмієте, та що хочете відпрацювати далі. Інтерес до справи дає навчанню конкретну мету.",
        full: "Програма курсу: повний огляд",
        module: "Модуль",
        lessons: "занять",
        empty: "Детальна програма готується.",
        cta: "Почніть із першого ескізу",
        ctaText:
          "Ознайомтеся з деталями курсу та запишіться, коли будете готові почати.",
        access:
          "Відеоуроки доступні студентам після оплати курсу. Студентський доступ не дає права редагувати курс.",
        library: "Уже придбали? Відкрити мою бібліотеку",
        price: "Поточна вартість курсу",
      };
  const count = modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );
  const heading =
    "font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl";
  return (
    <article className="space-y-16 pb-10 sm:space-y-20">
      <header className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="text-xs font-semibold tracking-widest text-[var(--accent-dk)]">
            {copy.tag}
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {copy.title}
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            {copy.intro}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#programme" className="btn-primary">
              {copy.programme} <span aria-hidden>↓</span>
            </a>
            <Link href={detail} className="btn-ghost">
              {copy.details}
            </Link>
          </div>
        </div>
        {cover ? (
          <div className="card overflow-hidden p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={en ? "Furniture in an interior" : "Меблі в інтер’єрі"}
              className="aspect-[4/3] w-full rounded-xl object-cover"
              fetchPriority="high"
            />
          </div>
        ) : null}
      </header>
      <section aria-labelledby="results-title" className="space-y-6">
        <h2 id="results-title" className={heading}>
          {copy.results}
        </h2>
        <dl className="grid grid-cols-3 divide-x divide-[var(--line)] rounded-2xl bg-[var(--panel)] py-7 text-center">
          {[modules.length || "—", count || "—", 3].map((value, i) => (
            <div key={i}>
              <dd className="font-display text-3xl font-bold sm:text-5xl">
                {value}
              </dd>
              <dt className="mt-2 text-xs text-[var(--muted)] sm:text-sm">
                {copy.stats[i]}
              </dt>
            </div>
          ))}
        </dl>
        <div className="grid gap-4 md:grid-cols-3">
          {copy.outcomes.map(([name, text]) => (
            <div key={name} className="card p-6">
              <h3 className="font-semibold">{name}</h3>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="audience-title" className="space-y-6">
        <h2 id="audience-title" className={heading}>
          {copy.audience}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {copy.people.map(([name, text], i) => (
            <div key={name} className="border-t-2 border-[var(--accent)] pt-5">
              <span
                aria-hidden
                className="font-mono text-sm text-[var(--accent-dk)]"
              >
                0{i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{name}</h3>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="path-title" className="space-y-6">
        <div>
          <h2 id="path-title" className={heading}>
            {copy.path}
          </h2>
          <p className="mt-3 text-[var(--muted)]">{copy.pathIntro}</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {copy.steps.map(([name, text], i) => (
            <li
              key={name}
              className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-5"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--foreground)] font-mono text-sm text-white">
                {i + 1}
              </span>
              <h3 className="mt-5 text-sm font-semibold">{name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {text}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="learning-title" className="space-y-6">
        <h2 id="learning-title" className={heading}>
          {copy.learning}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {copy.methods.map(([name, text]) => (
            <div key={name} className="card p-6">
              <h3 className="text-base font-semibold">{name}</h3>
              <p className="mt-3 leading-relaxed text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <aside className="grid gap-6 rounded-2xl bg-[var(--panel)] p-7 sm:p-10 md:grid-cols-2">
        <h2 className={heading}>{copy.motivation}</h2>
        <p className="text-lg leading-relaxed text-[var(--muted)]">
          {copy.motivationText}
        </p>
      </aside>
      <section
        id="programme"
        aria-labelledby="programme-title"
        className="scroll-mt-24 space-y-6"
      >
        <h2 id="programme-title" className={heading}>
          {copy.full}
        </h2>
        <div className="space-y-3">
          {modules.length ? (
            modules.map((module, i) => (
              <details key={i} className="card overflow-hidden" open={i === 0}>
                <summary className="cursor-pointer px-5 py-5 font-semibold">
                  <span className="mr-3 text-[var(--accent-dk)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {module.title}
                  <span className="ml-3 text-sm font-normal text-[var(--muted)]">
                    {module.lessons.length} {copy.lessons}
                  </span>
                </summary>
                <ol className="list-inside list-decimal space-y-3 border-t border-[var(--line)] p-5 text-[var(--muted)]">
                  {module.lessons.map((lesson, j) => (
                    <li key={j}>{lesson.replace(/^\s*\d+[.)]\s*/, "")}</li>
                  ))}
                </ol>
              </details>
            ))
          ) : (
            <p className="text-[var(--muted)]">{copy.empty}</p>
          )}
        </div>
      </section>
      <section className="card grid gap-8 p-7 sm:p-10 md:grid-cols-[1fr_18rem]">
        <div>
          <h2 className={heading}>{copy.cta}</h2>
          <p className="mt-4 leading-relaxed text-[var(--muted)]">
            {copy.ctaText}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
            {copy.access}
          </p>
          <Link
            href="/account/library/furniture-makers"
            className="mt-5 inline-block text-sm font-medium underline underline-offset-4"
          >
            {copy.library}
          </Link>
        </div>
        <div className="flex flex-col justify-center gap-4">
          <p className="text-sm text-[var(--muted)]">
            {copy.price}
            <strong className="mt-2 block font-display text-3xl text-[var(--foreground)]">
              {price}
            </strong>
          </p>
          <Link href={detail} className="btn-primary">
            {copy.details}
          </Link>
        </div>
      </section>
    </article>
  );
}
