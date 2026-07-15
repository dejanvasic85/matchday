#!/usr/bin/env node
// matchday scraper CLI (`mday`) — playwright-core with real Chrome to clear Dribl's Cloudflare,
// then direct mc-api.dribl.com calls. Browser endpoint abstracted (thanos <-> managed). Jobs are
// exposed as subcommands (`mday clubs`, ...) so the same invocation serves local runs and the
// scheduler. See the dribl-crawling skill.

import { runMain } from "citty";
import { mainCommand } from "./cli.ts";

void runMain(mainCommand);
