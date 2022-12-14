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

import captcha from "./captcha/mod.ts";
import help from "./help.ts";
import locks from "./locks.ts";
import logChannels from "./log_channels.ts";
import messages from "./messages.ts";
import restrictions from "./restrictions.ts";
import warns from "./warns.ts";
import { Context } from "$utilities";
import { autoQuote } from "grammy_autoquote";
import { Composer } from "grammy";

const composer = new Composer<Context>();

export default composer;

composer.chatType("supergroup").use(autoQuote);

composer.use(captcha);
composer.use(help);
composer.use(locks);
composer.use(logChannels);
composer.use(messages);
composer.use(restrictions);
composer.use(warns);
