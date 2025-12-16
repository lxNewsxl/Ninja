import * as esbuild from 'esbuild'

let result = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  outdir: 'public',
})
console.log(result)
