#!/usr/bin/env bun
// PreToolUse guard for Bash: mechanizes the branch policy and the .env rule
// from CLAUDE.md. Denies the tool call by printing a permissionDecision;
// anything not denied falls through to the normal permission flow.

interface HookInput {
	tool_name?: string;
	tool_input?: { command?: string };
}

function deny(reason: string): never {
	console.log(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PreToolUse",
				permissionDecision: "deny",
				permissionDecisionReason: reason,
			},
		}),
	);
	process.exit(0);
}

function currentBranch(): string {
	try {
		// --show-current, not rev-parse: it also resolves on a repo without commits.
		const proc = Bun.spawnSync(["git", "branch", "--show-current"], {
			timeout: 5_000,
			stdout: "pipe",
			stderr: "pipe",
		});
		return proc.exitCode === 0 ? new TextDecoder().decode(proc.stdout).trim() : "";
	} catch {
		return "";
	}
}

let input: HookInput;
try {
	input = JSON.parse(await Bun.stdin.text()) as HookInput;
} catch {
	process.exit(0);
}

if (input.tool_name !== "Bash") {
	process.exit(0);
}

const command = input.tool_input?.command ?? "";

// Segment-scoped so prose inside issue bodies or docs does not false-positive:
// the flag only counts inside a command segment that actually invokes git.
const segments = command.split(/[\n;|&]+/);
if (segments.some((s) => /\bgit\s/.test(s) && /\s--no-verify\b/.test(s))) {
	deny(
		"Gates de verificação não podem ser pulados (--no-verify). CLAUDE.md — Definição de pronto. Se a flag aparece apenas como texto (corpo de issue/PR), escreva o corpo num arquivo e use --body-file.",
	);
}

const writesCommitOrPr = /\bgit\s+commit\b|\bgh\s+pr\s+(create|edit)\b/.test(command);
if (writesCommitOrPr && (/co-authored-by:\s*claude/i.test(command) || /generated with \[?claude/i.test(command))) {
	deny("Nenhuma atribuição a assistente em commit ou PR, em nenhum trailer, nunca. CLAUDE.md — Commits.");
}

const touchesDotEnv =
	/(?:^|[\s|;&()])(?:cat|type|less|more|head|tail|bat|strings|sed|awk|grep|rg|cp|mv|tee|code|notepad|vim|nano|touch|rm|del)\b[^|;&\n]*[\s"'=/\\]\.env(?:\.[\w.-]+)?\b/.test(
		command,
	) || /[>]{1,2}\s*[^|;&\s]*\.env(?:\.[\w.-]+)?\b/.test(command);
if (touchesDotEnv) {
	deny(
		"Arquivo .env (incluindo o de exemplo) só é lido, criado ou editado com pedido explícito do usuário. CLAUDE.md — Nunca. Peça ao usuário e use as ferramentas de arquivo, que passam pelo prompt de permissão.",
	);
}

// Spans stop at command separators so a flag of a *different* command on the
// same line (e.g. `git push origin x && gh pr create --base main`) never counts.
const isGitCommitOrPush = /\bgit\b[^\n;|&]*\b(commit|push)\b/.test(command);
if (isGitCommitOrPush && currentBranch() === "main") {
	deny(
		"Você está na main. Nada entra nela por commit ou push direto: crie uma branch (feat/, fix/, docs/, chore/) e abra PR. CLAUDE.md — Processo.",
	);
}

if (/\bgit\s+push\b[^\n;|&]*[\s:+]main(?![\w/-])/.test(command)) {
	deny(
		"Push direcionado à main é bloqueado: a main só recebe merge por Pull Request aprovado. A exceção existe apenas quando o dono do repositório pede explicitamente, caso a caso.",
	);
}

process.exit(0);
