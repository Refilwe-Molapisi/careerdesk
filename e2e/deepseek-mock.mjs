import http from "node:http";

/**
 * Fake DeepSeek (OpenAI-compatible) server for the E2E run. Started before
 * the test suite; the app's DEEPSEEK_BASE_URL points at it so no real AI
 * calls leave the machine.
 *
 * Modes are switched by the tests through /mode:
 *   honest   -> well-formed responses citing the entry id the test creates
 *   poisoned -> a fake source id and an unsupported number, which the server
 *               must reject (the spec's required negative case)
 */
let mode = "honest";

const ENTRY_ID = "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1";

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/mode" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      mode = JSON.parse(body).mode;
      res.end(JSON.stringify({ mode }));
    });
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const userPrompt = String(JSON.parse(body).messages?.[1]?.content ?? "");
    let content: unknown;

    if (userPrompt.includes("TASK: produce a fit report")) {
      content = {
        summary: "Mostly evidenced.",
        requirements: [
          {
            requirement: "Excel reconciliation experience",
            status: "evidenced",
            entry_ids: [ENTRY_ID],
            note: "",
          },
          {
            requirement: "Capital markets reporting",
            status: "gap",
            entry_ids: [],
            note: "Nothing in the record.",
          },
        ],
      };
    } else if (userPrompt.includes("TASK: draft a one-page-ready CV")) {
      content =
        mode === "poisoned"
          ? {
              summary: { text: "Finance assistant moving into BI.", entry_ids: [ENTRY_ID] },
              skills: [{ text: "Excel", entry_ids: [ENTRY_ID] }],
              experience: [
                {
                  entry_id: ENTRY_ID,
                  heading: "Finance assistant - Acme Trading",
                  bullets: [
                    // unsupported number: the entry says 300, this says 5000
                    { text: "Reconciled 5000 supplier accounts monthly in Excel.", entry_ids: [ENTRY_ID] },
                  ],
                },
              ],
              projects: [],
              education: [],
            }
          : {
              summary: { text: "Finance assistant moving into BI.", entry_ids: [ENTRY_ID] },
              skills: [{ text: "Excel", entry_ids: [ENTRY_ID] }],
              experience: [
                {
                  entry_id: ENTRY_ID,
                  heading: "Finance assistant - Acme Trading",
                  bullets: [
                    { text: "Reconciled 300 supplier accounts monthly in Excel.", entry_ids: [ENTRY_ID] },
                  ],
                },
              ],
              projects: [],
              education: [],
            };
    } else if (userPrompt.includes("TASK: draft a cover letter")) {
      content = {
        greeting: "Dear Hiring Manager,",
        paragraphs: [
          {
            text: "I am applying for the BI analyst role. My reconciliation work used Excel daily.",
            entry_ids: [ENTRY_ID],
          },
        ],
        closing: "Kind regards,",
      };
    } else if (userPrompt.includes("TASK: claim check")) {
      content = { issues: [] };
    } else if (userPrompt.includes("TASK: revise one part")) {
      content = {
        lines: [{ text: "Reconciled 300 supplier accounts monthly and weekly in Excel.", entry_ids: [ENTRY_ID] }],
      };
    } else {
      content = { proposals: [] };
    }

    res.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }],
      }),
    );
  });
});

server.listen(3222, "127.0.0.1");
console.log("DeepSeek mock on http://127.0.0.1:3222");
