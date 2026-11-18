import esbuild from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const prod = process.argv[2] === "production";
const outdir = "dist";

await mkdir(outdir, { recursive: true });

const copyStatic = {
	name: "copy-static",
	setup(build) {
		build.onEnd(async () => {
			await copyFile("manifest.json", `${outdir}/manifest.json`);
			await copyFile("styles.css", `${outdir}/styles.css`);
		});
	},
};

const ctx = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
	format: "cjs",
	target: "es2020",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: `${outdir}/main.js`,
	plugins: [copyStatic],
});

if (prod) {
	await ctx.rebuild();
	await ctx.dispose();
} else {
	await ctx.watch();
}
