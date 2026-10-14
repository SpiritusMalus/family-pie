import {cp, mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildPortfolioSite(output=resolve(project,'portfolio-site/dist')) {
  output=resolve(output);
  if(output===project||output===resolve(project,'site')||!output.startsWith(project+'/'))throw Error('Refusing unsafe output path');
  await mkdir(output,{recursive:true});
  const existing=await readdir(output);
  if(existing.length&&!existing.includes('.portfolio-build'))throw Error('Refusing to overwrite an unmanaged directory');
  for(const name of existing)await rm(resolve(output,name),{recursive:true,force:true});
  await writeFile(resolve(output,'.portfolio-build'),'Family Pie portfolio artifact\n');
  await cp(resolve(project,'site'),output,{recursive:true,filter:source=>{
    const path=relative(resolve(project,'site'),source).replaceAll('\\','/');
    return !/^(vpn|sufler)(\/|$)/.test(path);
  }});
  return {output};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildPortfolioSite(process.argv[2])));
