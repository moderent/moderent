/**
 * This file is part of Moderent.
 *
 * Moderent is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Moderent is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Afferto General Public License
 * along with Moderent.  If not, see <https://www.gnu.org/licenses/>.
 */

import handlers from "./handlers/mod.ts";
import workers from "./workers/mod.ts";
import { Context, initialize, session } from "$utilities";
import { connect } from "$database";
import env from "$env";
import { hydrateReply } from "grammy_parse_mode";
import { Bot, webhookCallback } from "grammy";
import { serve } from "std/http/server.ts";

const bot = new Bot<Context>(env.BOT_TOKEN);

bot.use(hydrateReply);
bot.use(session);
bot.use(workers);
bot.use(handlers);

await connect();
await initialize();

if (env.USE_WEBHOOK) {
  const handleUpdate = webhookCallback(bot, "std/http");
  serve((request) => {
    if (new URL(request.url).pathname == `/${bot.token}`) {
      return handleUpdate(request);
    }
  }, { hostname: env.WEBHOOK_HOST, port: env.WEBHOOK_PORT });
} else {
  bot.start({
    drop_pending_updates: true,
    allowed_updates: [
      "callback_query",
      "chat_join_request",
      "chat_member",
      "message",
    ],
  });
}
