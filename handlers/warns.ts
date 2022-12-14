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

import {
  getSettings,
  getWarns,
  rmwarn,
  updateSettings,
  warn,
  WarnMode,
  WarnTDuration,
} from "$database";
import {
  Context,
  getRestrictionParameters,
  getUntilDate,
  logRestrictionEvent,
  withRights,
} from "$utilities";
import { fmt, mentionUser } from "grammy_parse_mode";
import { Composer } from "grammy";

const composer = new Composer<Context>();
const filter = composer.chatType("supergroup");
const rights = withRights("can_restrict_members");
const rights2 = withRights(["can_change_info", "can_restrict_members"]);

filter.command(["warn", "dwarn", "swarn"], rights, async (ctx) => {
  const { user, reason } = getRestrictionParameters(ctx, true);
  if (!user) {
    await ctx.reply("Target not specified.");
    return;
  } else if (
    ctx.session.admins.has(user) ||
    user == ctx.msg.reply_to_message?.from?.id &&
      ctx.msg.reply_to_message.from.is_bot
  ) {
    await ctx.reply("Can\u2019t warn admins or bots.");
    return;
  }
  let isMember = false;
  try {
    isMember = ["member", "restricted"]
      .includes((await ctx.getChatMember(user)).status);
  } catch (_err) {
    //
  }
  if (!isMember) {
    await ctx.reply("The target user is not a member.");
    return;
  }
  const command = ctx.msg.text.slice(1, ctx.msg.entities[0].length);
  if (command == "dwarn" && ctx.msg.reply_to_message) {
    await ctx.api.deleteMessage(
      ctx.chat.id,
      ctx.msg.reply_to_message.message_id,
    );
  } else if (command == "swarn") {
    await ctx.deleteMessage();
  }
  const warns = await warn(user, ctx.chat.id);
  const { warnLimit, warnMode, warnTDuration } =
    (await getSettings(ctx.chat.id));
  logRestrictionEvent(
    ctx,
    `WARN ${warns}/${warnLimit}`,
    ctx.from,
    user,
    reason ? `Reason: ${reason}` : "",
  );
  const other = "Reason: Warn limit reached";
  let rud = "";
  if (warns >= warnLimit) {
    await rmwarn(user, ctx.chat.id, true);
    switch (warnMode) {
      case WarnMode.Ban:
        await ctx.banChatMember(user);
        logRestrictionEvent(
          ctx,
          "BAN",
          ctx.from,
          user,
          other,
        );
        break;
      case WarnMode.Mute:
        await ctx.restrictChatMember(user, { can_send_messages: false });
        logRestrictionEvent(
          ctx,
          "MUTE",
          ctx.from,
          user,
          other,
        );
        break;
      case WarnMode.Tban: {
        const { untilDate, readableUntilDate } = getUntilDate(warnTDuration);
        rud = readableUntilDate;
        await ctx.banChatMember(user, { until_date: untilDate });
        logRestrictionEvent(
          ctx,
          `BAN${readableUntilDate}`,
          ctx.from,
          user,
          other,
        );
        break;
      }
      case WarnMode.Tmute: {
        const { untilDate, readableUntilDate } = getUntilDate(warnTDuration);
        rud = readableUntilDate;
        await ctx.restrictChatMember(
          user,
          { can_send_messages: false },
          { until_date: untilDate },
        );
        logRestrictionEvent(
          ctx,
          `MUTE${readableUntilDate}`,
          ctx.from,
          user,
          other,
        );
      }
    }
  }
  await ctx.replyFmt(
    fmt`${mentionUser(user, user)} was warned${
      reason ? ` for:\n${reason}\n\n` : ". "
    }${
      warns >= warnLimit
        ? fmt`This was the last warn. ${mentionUser(user, user)} was ${
          warnMode.includes("ban") ? "bann" : "mut"
        }ed${rud}.`
        : `This is the ${warns}${
          warns == 1 ? "st" : warns == 2 ? "nd" : warns == 3 ? "rd" : "th"
        } warn.`
    }`,
  );
});

filter.command("rmwarn", rights, async (ctx) => {
  const { user, reason } = getRestrictionParameters(ctx, true);
  if (!user) {
    await ctx.reply("Target not specified.");
    return;
  } else if (
    ctx.session.admins.has(user) ||
    user == ctx.msg.reply_to_message?.from?.id &&
      ctx.msg.reply_to_message.from.is_bot
  ) {
    await ctx.reply("Can\u2019t warn admins or bots.");
    return;
  }
  if (await rmwarn(user, ctx.chat.id)) {
    logRestrictionEvent(
      ctx,
      "RMWARN",
      ctx.from,
      user,
      reason ? `Reason: ${reason}` : "",
    );
    await ctx.replyFmt(
      fmt`Removed ${mentionUser(user, user)}\u2019s last warning.`,
    );
  } else {
    await ctx.replyFmt(fmt`${mentionUser(user, user)} has no warnings.`);
  }
});

filter.command("resetwarn", rights, async (ctx) => {
  const { user, reason } = getRestrictionParameters(ctx, true);
  if (!user) {
    await ctx.reply("Target not specified.");
    return;
  } else if (
    ctx.session.admins.has(user) ||
    user == ctx.msg.reply_to_message?.from?.id &&
      ctx.msg.reply_to_message.from.is_bot
  ) {
    await ctx.reply("Can\u2019t warn admins or bots.");
    return;
  }
  if (await rmwarn(user, ctx.chat.id, true)) {
    logRestrictionEvent(
      ctx,
      "RESETWARN",
      ctx.from,
      user,
      reason ? `Reason: ${reason}` : "",
    );
    await ctx.replyFmt(
      fmt`Removed ${mentionUser(user, user)}\u2019s warnings.`,
    );
  } else {
    await ctx.replyFmt(fmt`${mentionUser(user, user)} has no warnings.`);
  }
});

filter.command("warns", rights, async (ctx) => {
  const { user } = getRestrictionParameters(ctx, true);
  if (!user) {
    await ctx.reply("Target not specified.");
    return;
  } else if (
    ctx.session.admins.has(user) ||
    user == ctx.msg.reply_to_message?.from?.id &&
      ctx.msg.reply_to_message.from.is_bot
  ) {
    await ctx.reply("Can\u2019t warn admins or bots.");
    return;
  }
  const warns = await getWarns(user, ctx.chat.id);
  await ctx.replyFmt(
    `${mentionUser(user, user)} has ${warns} warn${warns == 1 ? "" : "s"}.`,
  );
});

filter.command("warnlimit", rights2, async (ctx) => {
  const warnLimit = Number(ctx.msg.text.split(/\s/)[1]);
  if (isNaN(warnLimit)) {
    await ctx.reply("Invalid limit specified.");
    return;
  } else if (warnLimit < 2) {
    await ctx.reply("Warn limit cannot be less than 2.");
    return;
  } else if (warnLimit > 10) {
    await ctx.reply("Warn limit cannot be more than 10.");
    return;
  }
  if (await updateSettings(ctx.chat.id, { warnLimit })) {
    await ctx.reply("Warn limit changed.");
  } else {
    await ctx.reply("Warn limit was not changed.");
  }
});

filter.command("warnmode", rights2, async (ctx) => {
  const args = ctx.msg.text.split(/\s/);
  const warnMode = args[1];
  const warnTDuration = args[2];
  if (!warnMode) {
    await ctx.reply("Warn mode not specified.");
    return;
  } else if (["tban", "tmute"].includes(warnMode)) {
    if (!warnTDuration) {
      await ctx.reply("Duration not specified.");
      return;
    } else if (!getUntilDate(warnTDuration).readableUntilDate) {
      await ctx.reply("Invalid duration specified.");
      return;
    }
  } else if (!["ban", "mute"].includes(warnMode)) {
    await ctx.reply("Invalid warn mode specified.");
    return;
  }
  if (
    await updateSettings(
      ctx.chat.id,
      {
        warnMode: warnMode as WarnMode,
        warnTDuration: warnTDuration as WarnTDuration,
      },
    )
  ) {
    await ctx.reply("Warn mode changed.");
  } else {
    await ctx.reply("Warn mode was not changed.");
  }
});

export default composer;
