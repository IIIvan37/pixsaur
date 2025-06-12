
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// netlify/functions/rasm/rasm.mts
import path from "path";
var { spawn } = __require("child_process");
var rasm_default = (request, context) => {
  const rasm = spawn(path.join(process.cwd(), "bin", "rasm"), [
    path.join(process.cwd(), "asm", "main.asm"),
    "-o",
    "pixsaur"
  ]);
  rasm.stdout.on("data", (data) => {
    console.log(`stdout: ${data}`);
  });
  rasm.stderr.on("data", (data) => {
    console.log(`stderr: ${data}`);
  });
  rasm.on("error", (error) => {
    console.log(`error: ${error.message}`);
  });
  rasm.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });
  const url = new URL(request.url);
  const subject = url.searchParams.get("name") || "World";
  return new Response(`Hello ${subject}`);
};
export {
  rasm_default as default
};
