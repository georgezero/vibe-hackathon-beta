/**
 * Build deterministic, disposable H.3 activation snapshots.
 * This script never accepts the canonical database and only writes beneath
 * the explicitly named H.3 qualification directory.
 */
import Database from "better-sqlite3";
import { cpSync, mkdirSync, lstatSync } from "node:fs";
import { resolve } from "node:path";

const root = "/opt/vibe-hackathon/instances/kentucky-vibes-h3-activation-20260810T173000Z";
const base = `${root}/data/activation.sqlite`;
const stages = ["empty", "sparse", "active", "closed", "published"] as const;
type Stage = typeof stages[number];

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

function safePath(value: string | undefined, label: string) {
  if (!value || !value.startsWith(`${root}/data/`) || value === `${root}/data/`) throw new Error(`${label} must be beneath ${root}/data.`);
  if (value === resolve(process.cwd(), "local.db")) throw new Error("The canonical database is not a qualification target.");
  return resolve(value);
}

function nowSeconds() { return Math.floor(Date.now() / 1000); }

function provisionChannels(db: Database.Database, eventId: string) {
  const channels = [
    ["general", "General", "Event-wide discussion for participants.", "discussion", "participants", 10],
    ["announcements", "Announcements", "Official updates from the event organizers.", "announcements", "admins_only", 20],
    ["team-up", "Team-up", "Find teammates and collaborators for your next build.", "discussion", "participants", 30],
    ["technical-help", "Technical help", "Ask implementation questions and share what is working.", "discussion", "participants", 40],
  ] as const;
  const stamp = nowSeconds();
  const insert = db.prepare("INSERT OR IGNORE INTO community_channels (id,event_id,slug,name,description,type,visibility,posting_policy,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?, 'participants', ?, 'active', ?, ?, ?)");
  for (const [slug, name, description, type, policy, sort] of channels) insert.run(`h3_channel_${slug}`, eventId, slug, name, description, type, policy, sort, stamp, stamp);
}

function provisionSyntheticSocial(db: Database.Database, stage: Stage, eventId: string) {
  db.prepare("DELETE FROM user_profiles").run();
  db.prepare("DELETE FROM community_messages").run();
  db.prepare("DELETE FROM direct_messages").run();
  db.prepare("DELETE FROM direct_conversation_members").run();
  db.prepare("DELETE FROM direct_conversations").run();
  if (stage === "empty") return;
  const users = db.prepare("SELECT id FROM users ORDER BY id LIMIT ?").all(stage === "sparse" ? 1 : 3) as Array<{ id: string }>;
  const stamp = nowSeconds();
  const profile = db.prepare("INSERT INTO user_profiles (id,user_id,handle,display_name,headline,affiliation,interests,visibility,discoverable,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  users.forEach((user, index) => profile.run(`h3_profile_${index + 1}`, user.id, `h3-builder-${index + 1}`, `H.3 Synthetic Builder ${index + 1}`, "Building an early-event prototype", "H.3 Qualification Lab", "AI, design, collaboration", "public", 1, stamp, stamp));
  if (stage === "sparse") return;
  const general = db.prepare("SELECT id FROM community_channels WHERE event_id = ? AND slug = 'general'").get(eventId) as { id: string } | undefined;
  if (general && users[0]) db.prepare("INSERT INTO community_messages (id,channel_id,author_user_id,body,client_message_id,created_at) VALUES (?,?,?,?,?,?)").run("h3_message_general_1", general.id, users[0].id, "Synthetic early-event hello", "h3-client-general-1", stamp);
  if (users.length >= 2) {
    const [a, b] = [users[0].id, users[1].id].sort();
    db.prepare("INSERT INTO direct_conversations (id,participant_a_user_id,participant_b_user_id,created_at,updated_at) VALUES (?,?,?,?,?)").run("h3_conversation_1", a, b, stamp, stamp);
    db.prepare("INSERT INTO direct_conversation_members (id,conversation_id,user_id,created_at) VALUES (?,?,?,?), (?,?,?,?)").run("h3_member_1", "h3_conversation_1", a, stamp, "h3_member_2", "h3_conversation_1", b, stamp);
    db.prepare("INSERT INTO direct_messages (id,conversation_id,author_user_id,body,client_message_id,created_at) VALUES (?,?,?,?,?,?)").run("h3_dm_1", "h3_conversation_1", users[0].id, "Synthetic collaboration hello", "h3-client-dm-1", stamp);
  }
  if (stage === "published" && general) {
    for (let i = 2; i <= 3; i += 1) if (users[i]) db.prepare("INSERT INTO community_messages (id,channel_id,author_user_id,body,client_message_id,created_at) VALUES (?,?,?,?,?,?)").run(`h3_message_general_${i}`, general.id, users[i].id, `Synthetic early-event update ${i}`, `h3-client-general-${i}`, stamp + i);
  }
}

function createStage(stage: Stage, output: string) {
  cpSync(base, output);
  const db = new Database(output);
  db.pragma("foreign_keys = ON");
  const tx = db.transaction(() => {
    const original = db.prepare("SELECT * FROM events WHERE id = 'evt_kentucky_vibes'").get() as Record<string, unknown>;
    if (!original) throw new Error("Base fixture is missing evt_kentucky_vibes.");
    const eventId = stage === "empty" ? "evt_h3_empty" : "evt_kentucky_vibes";
    if (stage === "empty") {
      const existing = db.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
      if (!existing) {
        db.prepare("INSERT INTO events (id,name,slug,is_active,is_frozen,start_date,submission_deadline,judging_deadline,audience_voting_enabled,audience_award_count,audience_votes_per_person,audience_voting_starts_at,audience_voting_ends_at,audience_results_visible,audience_voting_mode,audience_identity_method,winners_published_at,show_judge_choice,show_peoples_choice,show_ai_choice,show_special_awards,display_name,logo_url,tagline,external_url,llm_judging_enabled,llm_judging_affects_official_score,created_at,updated_at) SELECT ?, 'H.3 Activation Preview', 'h3-activation-preview', 1, 0, start_date, NULL, NULL, audience_voting_enabled, audience_award_count, audience_votes_per_person, NULL, NULL, 0, audience_voting_mode, audience_identity_method, NULL, show_judge_choice, show_peoples_choice, show_ai_choice, show_special_awards, 'H.3 Activation Preview', logo_url, tagline, external_url, llm_judging_enabled, llm_judging_affects_official_score, created_at, updated_at FROM events WHERE id = 'evt_kentucky_vibes'").run(eventId);
      }
      db.prepare("UPDATE events SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE is_active = 1 OR id = ?").run(eventId, eventId);
      provisionChannels(db, eventId);
      provisionSyntheticSocial(db, stage, eventId);
      db.prepare("DELETE FROM participant_journey_events WHERE event_id = ?").run(eventId);
      db.prepare("DELETE FROM participant_feedback WHERE event_id = ?").run(eventId);
    } else {
      db.prepare("UPDATE events SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE is_active = 1 OR id = ?").run(eventId, eventId);
      provisionChannels(db, eventId);
      db.prepare("DELETE FROM community_messages").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM direct_conversation_members").run();
      db.prepare("DELETE FROM direct_conversations").run();
      provisionSyntheticSocial(db, stage, eventId);
      if (stage === "closed" || stage === "published") {
        const past = nowSeconds() - 86400;
        db.prepare("UPDATE events SET is_frozen = 0, submission_deadline = ?, judging_deadline = ?, winners_published_at = NULL WHERE id = ?").run(past, past + 3600, eventId);
      } else {
        db.prepare("UPDATE events SET is_frozen = 0, submission_deadline = NULL, judging_deadline = NULL, winners_published_at = NULL WHERE id = ?").run(eventId);
      }
      db.prepare("DELETE FROM publication_releases WHERE event_id = ?").run(eventId);
      if (stage === "published") {
        const stamp = nowSeconds();
        db.prepare("INSERT INTO publication_releases (id,event_id,status,publication_mode,show_scores,published_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("h3_pub_evt_kentucky_vibes", eventId, "published", "awards_feedback", 1, stamp, stamp);
      }
      db.prepare("DELETE FROM participant_journey_events WHERE event_id = ?").run(eventId);
      db.prepare("DELETE FROM participant_feedback WHERE event_id = ?").run(eventId);
    }
  });
  tx();
  const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
  const foreignKeys = db.pragma("foreign_key_check") as unknown[];
  const event = db.prepare("SELECT id,is_active,is_frozen,submission_deadline,judging_deadline FROM events WHERE is_active = 1").get();
  const counts = {
    submissions: Number((db.prepare("SELECT count(*) AS count FROM submissions WHERE event_id = (SELECT id FROM events WHERE is_active = 1)").get() as { count: number }).count),
    profiles: Number((db.prepare("SELECT count(*) AS count FROM user_profiles").get() as { count: number }).count),
    communityMessages: Number((db.prepare("SELECT count(*) AS count FROM community_messages").get() as { count: number }).count),
    directMessages: Number((db.prepare("SELECT count(*) AS count FROM direct_messages").get() as { count: number }).count),
  };
  db.close();
  if (integrity[0]?.integrity_check !== "ok" || foreignKeys.length) throw new Error(`Invalid ${stage} fixture.`);
  return { stage, output, event, counts, integrity: "ok", foreignKeys: "passed", syntheticOnly: true };
}

const requested = arg("--stage");
const outputArg = arg("--output");
if (requested && !stages.includes(requested as Stage)) throw new Error(`--stage must be one of ${stages.join(", ")}.`);
const selected = requested ? [requested as Stage] : [...stages];
mkdirSync(`${root}/data`, { recursive: true });
if (!lstatSync(base).isFile()) throw new Error(`Missing base fixture: ${base}`);
const results = selected.map((stage) => createStage(stage, safePath(outputArg && selected.length === 1 ? outputArg : `${root}/data/h3-${stage}.sqlite`, "--output")));
console.log(JSON.stringify({ root, source: base, fixtures: results }, null, 2));
