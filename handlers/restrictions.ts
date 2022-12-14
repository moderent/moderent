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
  Context,
  getRestrictionParameters,
  logChatEvent,
  logRestrictionEvent,
  withRights,
} from "$utilities";
import { fmt, mentionUser } from "grammy_parse_mode";
import { Composer } from "grammy";

const composer = new Composer<Context>();
const filter = composer.chatType("supergroup");
const rights = withRights("can_restrict_members");
const rights2 = withRights(["can_restrict_members", "can_delete_messages"]);

// merge ban, dban, sban like warn? same for mute, smute, dmute
filter.command(["ban", "dban", "sban"], rights, async (ctx) => {
  const params = getRestrictionParameters(ctx);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  const command = ctx.msg.text.slice(1, ctx.msg.entities[0].length);
  if (command.startsWith("d") && ctx.msg.reply_to_message) {
    await ctx.api.deleteMessage(
      ctx.chat.id,
      ctx.msg.reply_to_message.message_id,
    );
  }
  await ctx.banChatMember(params.user, { until_date: params.untilDate });
  logRestrictionEvent(
    ctx,
    `BAN${params.readableUntilDate}`,
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  if (!command.startsWith("s")) {
    await ctx.replyFmt(
      fmt`Banned ${
        mentionUser(params.user, params.user)
      }${params.readableUntilDate}.`,
    );
  } else {
    await ctx.deleteMessage();
  }
});

filter.command("unban", rights, async (ctx) => {
  const params = getRestrictionParameters(ctx, true);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  await ctx.unbanChatMember(params.user);
  logRestrictionEvent(
    ctx,
    "UNBAN",
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  await ctx.replyFmt(fmt`Unbanned ${mentionUser(params.user, params.user)}.`);
});

filter.command("kick", rights, async (ctx) => {
  const params = getRestrictionParameters(ctx, true);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  await ctx.banChatMember(params.user);
  await new Promise((r) => setTimeout(r, 1000)); // necessary?
  await ctx.unbanChatMember(params.user);
  logRestrictionEvent(
    ctx,
    "KICK",
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  await ctx.replyFmt(fmt`Kicked ${mentionUser(params.user, params.user)}.`);
});

filter.command("dkick", rights2, async (ctx) => {
  const params = getRestrictionParameters(ctx, true);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  await ctx.banChatMember(params.user, { until_date: params.untilDate });
  await new Promise((r) => setTimeout(r, 1000));
  await ctx.unbanChatMember(params.user);
  logRestrictionEvent(
    ctx,
    "KICK",
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  if (ctx.msg.reply_to_message) {
    await ctx.api.deleteMessage(
      ctx.chat.id,
      ctx.msg.reply_to_message.message_id,
    );
  }
});

filter.command(["mute", "dmute", "smute"], rights, async (ctx) => {
  const params = getRestrictionParameters(ctx);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  const command = ctx.msg.text.slice(1, ctx.msg.entities[0].length);
  if (command.startsWith("d") && ctx.msg.reply_to_message) {
    await ctx.api.deleteMessage(
      ctx.chat.id,
      ctx.msg.reply_to_message.message_id,
    );
  }
  await ctx.restrictChatMember(
    params.user,
    { can_send_messages: false },
    { until_date: params.untilDate },
  );
  logRestrictionEvent(
    ctx,
    `MUTE${params.readableUntilDate}`,
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  if (!command.startsWith("s")) {
    await ctx.replyFmt(
      fmt`Muted ${
        mentionUser(params.user, params.user)
      }${params.readableUntilDate}.`,
    );
  } else {
    await ctx.deleteMessage();
  }
});

filter.command("unmute", rights, async (ctx) => {
  const params = getRestrictionParameters(ctx, true);
  if (!params.user) {
    await ctx.reply("Target not specified.");
    return;
  }
  await ctx.restrictChatMember(
    params.user,
    {
      can_send_polls: true,
      can_change_info: true,
      can_invite_users: true,
      can_pin_messages: true,
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    },
  );
  logRestrictionEvent(
    ctx,
    "UNMUTE",
    ctx.from,
    params.user,
    `Reason: ${params.reason}`,
  );
  await ctx.replyFmt(`Unmuted ${mentionUser(params.user, params.user)}.`);
});

filter.on("chat_member", (ctx) => {
  const newMember = ctx.chatMember.new_chat_member;
  const oldMember = ctx.chatMember.old_chat_member;
  const { user } = newMember;
  if (ctx.from.id != ctx.me.id) {
    if (oldMember.status == "kicked" && newMember.status != "kicked") {
      logRestrictionEvent(ctx, "UNBAN", ctx.from, user);
    } else if (newMember.status == "kicked") {
      logRestrictionEvent(ctx, "BAN", ctx.from, user);
    } else if (newMember.status == "administrator") {
      logRestrictionEvent(ctx, "PROMOTE", ctx.from, user);
    } else if (newMember.status == "left") {
      logChatEvent(
        ctx,
        "LEAVE",
        fmt`User: ${
          mentionUser(
            user.first_name + (user.last_name ? " " + user.last_name : "") +
              (user.username ? ` (@${user.username})` : ""),
            user.id,
          )
        }`,
      );
    } else if (newMember.status == "restricted") {
      logRestrictionEvent(
        ctx,
        "RESTRICT",
        ctx.from,
        user,
        Object.entries(newMember)
          .filter(([k]) => k.startsWith("can_"))
          .map(
            ([k, v]) => [
              k.replace(
                /[a-z][a-z]+(_|$)/g,
                (s) => s[0].toUpperCase() + s.slice(1).replace(/_/g, "") + " ",
              ).trim(),
              v ? "Yes" : "No",
            ],
          )
          .map((v) => v.join(": "))
          .join("\n"),
      );
    } else if (
      oldMember.status == "restricted" && newMember.status == "member"
    ) {
      logRestrictionEvent(ctx, "DERESTRICT", ctx.from, user);
    }
  }
});

export default composer;
