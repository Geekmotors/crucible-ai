#!/usr/bin/env node
import { CrucibleCli } from './cli/crucible-cli.js';
import { InitCommand } from './cli/init-command.js';
import { NodeProjectFiles } from './cli/node-project-files.js';
import { StreamCliOutput } from './cli/stream-cli-output.js';

const output = new StreamCliOutput(process.stdout, process.stderr);
const init = new InitCommand(new NodeProjectFiles(process.cwd()), output);
process.exitCode = new CrucibleCli(init, output).run(process.argv.slice(2));
