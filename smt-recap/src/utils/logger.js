import chalk from "chalk";

const STEPS = {
  1: "Content Analysis & Script Generation",
  2: "Choose AI Voice",
  3: "Choose Feeling & Tone",
  4: "Vocal Formatting & Pausing",
  5: "Audio Generation (TTS)",
  6: "Visual Mapping & Syncing",
  7: "Subtitles & Visual Effects",
  8: "Final Review & Export",
};

export const logger = {
  step(num, message) {
    const stepName = STEPS[num] || "";
    console.log(
      chalk.cyan(`\n[Step ${num}]`) +
        chalk.bold(` ${stepName}`) +
        (message ? chalk.gray(` — ${message}`) : "")
    );
  },

  info(msg) {
    console.log(chalk.blue("  ℹ ") + msg);
  },

  success(msg) {
    console.log(chalk.green("  ✓ ") + msg);
  },

  warn(msg) {
    console.log(chalk.yellow("  ⚠ ") + msg);
  },

  error(msg) {
    console.log(chalk.red("  ✗ ") + msg);
  },

  script(text) {
    console.log(chalk.white("\n" + "─".repeat(60)));
    console.log(chalk.italic(text));
    console.log(chalk.white("─".repeat(60)));
  },

  banner() {
    console.log(
      chalk.magentaBright(`
  ███████╗███╗   ███╗████████╗    ██████╗ ███████╗ ██████╗ █████╗ ██████╗
  ██╔════╝████╗ ████║╚══██╔══╝    ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗
  ███████╗██╔████╔██║   ██║       ██████╔╝█████╗  ██║     ███████║██████╔╝
  ╚════██║██║╚██╔╝██║   ██║       ██╔══██╗██╔══╝  ██║     ██╔══██║██╔═══╝
  ███████║██║ ╚═╝ ██║   ██║       ██║  ██║███████╗╚██████╗██║  ██║██║
  ╚══════╝╚═╝     ╚═╝   ╚═╝       ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝
    `)
    );
    console.log(chalk.gray("  Myanmar AI Video Pipeline — 8-Step Automated Production\n"));
  },
};
