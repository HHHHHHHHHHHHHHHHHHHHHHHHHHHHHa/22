"use strict";

const { ScrollView, Text, View, TextInput, Button } = vendetta.ui.components.General;
const { FormRow, FormIcon, FormDivider, FormSwitchRow } = vendetta.ui.components.Forms;

const RowManager = vendetta.metro.findByName("RowManager");

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRules() {
    return JSON.parse(vendetta.storage.rules || "[]")
        .map(rule => {
            try {
                if (rule.find === "" || rule.replace.includes(rule.find)) return null;

                return {
                    re: new RegExp(
                        rule.regex ? rule.find : escapeRegex(rule.find),
                        rule.ci ? "gi" : "g"
                    ),
                    to: rule.replace
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

vendetta.storage.rules ??= JSON.stringify([
    { find: "old", replace: "new", regex: false, ci: false }
]);
vendetta.storage.enabled ??= true;

let patches = [];

function applyPatches() {
    const UserStore = vendetta.metro.findByStoreName("UserStore");
    const Request = vendetta.metro.findByProps("put", "del", "post");

    // Patch message rendering
    patches.push(
        vendetta.patcher.before("generate", RowManager.prototype, function ([row]) {
            try {
                const rules = getRules();
                const msg = row?.message;

                for (const rule of rules) {
                    if (!msg) continue;

                    // ID spoofing
                    if (msg.author?.id) {
                        const newId = msg.author.id.replace(rule.re, rule.to);

                        if (newId !== msg.author.id && /^\d+$/.test(newId)) {
                            const target = UserStore.getUser(newId);
                            if (target) msg.author = target;
                            else msg.author.id = newId;
                        }
                    }

                    // Content
                    if (msg.content) {
                        msg.content = msg.content.replace(rule.re, rule.to);
                    }

                    // Author fields
                    ["username", "globalName", "avatar"].forEach(key => {
                        if (msg.author?.[key]) {
                            msg.author[key] = msg.author[key].replace(rule.re, rule.to);
                        }
                    });
                }
            } catch {}
        })
    );

    // Patch getUser
    patches.push(
        vendetta.patcher.before("getUser", UserStore, function (args) {
            try {
                const rules = getRules();
                for (const rule of rules) {
                    for (let i = 0; i < args.length; i++) {
                        if (args[i].match(rule.re)) {
                            args[i] = rule.to;
                        }
                    }
                }
            } catch {}
        })
    );
}

module.exports = {
    onLoad() {
        setTimeout(applyPatches, 0);
    },
    onUnload() {
        patches.forEach(p => p?.());
    }
};
