import * as readline from "node:readline/promises";

export interface PromptChoice {
  label: string;
  value: string;
}

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptChoice(
  prompt: string,
  choices: PromptChoice[],
): Promise<string> {
  if (choices.length === 0) {
    throw new Error("No choices available.");
  }

  for (const [index, choice] of choices.entries()) {
    console.error(`  ${index + 1}. ${choice.label}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    while (true) {
      const answer = await rl.question(
        `${prompt} [1-${choices.length}]: `,
      );
      const index = Number.parseInt(answer.trim(), 10);
      if (index >= 1 && index <= choices.length) {
        return choices[index - 1]!.value;
      }
      console.error("Invalid choice — enter a number from the list.");
    }
  } finally {
    rl.close();
  }
}
