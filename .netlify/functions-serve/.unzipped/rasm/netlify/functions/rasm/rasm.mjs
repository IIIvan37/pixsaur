
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
import fs from "fs/promises";
var { exec } = __require("child_process");
var rasm_default = async (request, context) => {
  const res = exec(
    `${path.join(process.cwd())}/bin/rasm ./asm/main.asm -o pixsaur`,
    async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return new Response(`Error: ${stderr}`, { status: 500 });
      }
      const out = await fs.readFile(
        path.join(process.cwd(), "pixsaur.dsk"),
        "binary"
      );
      console.log("here", out);
      return new Response(out);
    }
  );
  console.log("res", res);
};
export {
  rasm_default as default
};
