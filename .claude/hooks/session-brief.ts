#!/usr/bin/env bun
// SessionStart hook: prints a sync brief so every Claude Code session starts
// from the live state of the repository and its GitHub coordination surface.
// Every probe degrades to a note when unavailable — this script never blocks
// a session and always exits 0.

interface Probe {
	ok: boolean;
	out: string;
}

function run(cmd: string[], timeoutMs = 10_000): Probe {
	try {
		const proc = Bun.spawnSync(cmd, { timeout: timeoutMs, stdout: "pipe", stderr: "pipe" });
		return { ok: proc.exitCode === 0, out: new TextDecoder().decode(proc.stdout).trim() };
	} catch {
		return { ok: false, out: "" };
	}
}

function section(title: string): string {
	return `\n-- ${title} --`;
}

const lines: string[] = [];
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
lines.push(`== Vultra — brief de sessão (${stamp} UTC) ==`);

run(["git", "fetch", "origin", "--quiet"], 15_000);

const branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
if (branch.ok) {
	const counts = run(["git", "rev-list", "--left-right", "--count", "origin/main...HEAD"]);
	const [behind, ahead] = counts.ok ? counts.out.split(/\s+/) : ["?", "?"];
	lines.push(`Branch: ${branch.out} (${ahead} ahead / ${behind} behind de origin/main)`);
	if (branch.out === "main") {
		lines.push("AVISO: você está na main. Todo trabalho sai de uma branch própria e entra por PR (CLAUDE.md — Processo).");
	} else if (behind !== "0" && behind !== "?") {
		lines.push(`AVISO: esta branch está ${behind} commit(s) atrás de origin/main. Rebase antes de continuar.`);
	}
	const dirty = run(["git", "status", "--porcelain"]);
	if (dirty.ok && dirty.out.length > 0) {
		lines.push(`Working tree: ${dirty.out.split("\n").length} caminho(s) com mudanças não commitadas.`);
	}
	const remoteBranches = run([
		"git",
		"for-each-ref",
		"--sort=-committerdate",
		"--count=6",
		"--format=%(refname:short) | %(committerdate:short) | %(subject)",
		"refs/remotes/origin",
	]);
	if (remoteBranches.ok && remoteBranches.out) {
		lines.push(section("Branches remotas mais recentes"));
		lines.push(remoteBranches.out);
	}
} else {
	lines.push("(git indisponível — brief vazio)");
}

const ghOk = run(["gh", "auth", "status"], 8_000).ok;
if (ghOk) {
	const prs = run([
		"gh",
		"pr",
		"list",
		"--state",
		"open",
		"--limit",
		"10",
		"--json",
		"number,title,headRefName,author,reviewDecision,isDraft",
		"--template",
		'{{range .}}#{{.number}} {{.title}} ({{.headRefName}}, @{{.author.login}}){{if .isDraft}} [DRAFT]{{end}}{{if .reviewDecision}} [{{.reviewDecision}}]{{end}}{{"\\n"}}{{end}}',
	]);
	lines.push(section("PRs abertos — não atropele trabalho em andamento"));
	lines.push(prs.ok && prs.out ? prs.out : "(nenhum)");

	const assigned = run([
		"gh",
		"issue",
		"list",
		"--state",
		"open",
		"--limit",
		"100",
		"--json",
		"number,title,assignees",
		"--jq",
		'[.[] | select(.assignees | length > 0)] | .[:15] | .[] | "#\\(.number) \\(.title) → @\\([.assignees[].login] | join(", @"))"',
	]);
	lines.push(section("Issues assignadas — quem está em quê"));
	lines.push(assigned.ok && assigned.out ? assigned.out : "(nenhuma issue assignada — assigne a sua antes de começar)");

	const milestones = run([
		"gh",
		"api",
		"repos/{owner}/{repo}/milestones?state=open&sort=due_on&direction=asc",
		"--jq",
		'.[:2] | .[] | "\\(.title): \\(.open_issues) abertas / \\(.closed_issues) fechadas — prazo \\(.due_on[:10])"',
	]);
	if (milestones.ok && milestones.out) {
		lines.push(section("Milestones em curso"));
		lines.push(milestones.out);
	}
} else {
	lines.push("\n(gh indisponível ou sem login — brief parcial, só git local. Rode `gh auth login` para o brief completo.)");
}

lines.push(
	"\nRitual: todo trabalho nasce de uma issue e ela é assignada antes do primeiro commit; a base é origin/main atualizada; estado compartilhado vive no GitHub e nos docs versionados, nunca em memória local de agente.",
);

console.log(lines.join("\n"));
