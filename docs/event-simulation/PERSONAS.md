# Synthetic personas

The seed generates deterministic roles for a local simulation:

- participant owner with an active team;
- participant teammate and pending-invitation teammate;
- judge with assigned work;
- judge with completed/frozen work;
- judge with conflict/replacement work;
- unauthorized account with no event membership.

E.1 generated stable personas for the isolated service: synthetic admin,
high-workload/completed/conflict judges, complete/incomplete owners, an active
teammate with unread chat, and an unauthorized account. Credentials are outside
the repository in `/opt/vibe-hackathon/instances/kentucky-vibes/credentials/`.
Use only the selected-record command:

```sh
npm run event:persona:list -- kentucky-vibes
npm run event:persona:show -- kentucky-vibes admin
```

The file is mode `0600`; passwords are not in documentation or logs and all
synthetic mailboxes use `example.invalid`. No synthetic Viby identity links are
created.

E.2 assigned no approved human testers in the preparation window. Temporary
credentials were generated and removed after the pre-event snapshot; regenerate
them immediately before a scheduled rehearsal.
