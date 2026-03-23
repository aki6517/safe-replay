-- SafeReply Slack integration

CREATE TABLE IF NOT EXISTS slack_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    line_user_id TEXT NOT NULL REFERENCES users(line_user_id) ON DELETE CASCADE,
    slack_team_id TEXT NOT NULL,
    slack_team_name TEXT,
    slack_user_id TEXT NOT NULL,
    slack_user_name TEXT,
    bot_user_id TEXT,
    bot_access_token TEXT NOT NULL,
    bot_refresh_token TEXT,
    bot_token_expires_at TIMESTAMPTZ,
    user_access_token TEXT NOT NULL,
    user_refresh_token TEXT,
    user_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    user_scope TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_event_at TIMESTAMPTZ,
    last_error TEXT,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (line_user_id, slack_team_id, slack_user_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_installations_user_id
    ON slack_installations(user_id);

CREATE INDEX IF NOT EXISTS idx_slack_installations_line_user_id
    ON slack_installations(line_user_id);

CREATE INDEX IF NOT EXISTS idx_slack_installations_team_user
    ON slack_installations(slack_team_id, slack_user_id);

ALTER TABLE messages
    DROP CONSTRAINT IF EXISTS messages_source_type_check;

ALTER TABLE messages
    ADD CONSTRAINT messages_source_type_check
    CHECK (source_type IN ('gmail', 'chatwork', 'line_forward', 'slack'));

ALTER TABLE message_drafts
    DROP CONSTRAINT IF EXISTS message_drafts_sent_via_check;

ALTER TABLE message_drafts
    ADD CONSTRAINT message_drafts_sent_via_check
    CHECK (sent_via IN ('gmail', 'chatwork', 'slack') OR sent_via IS NULL);

ALTER TABLE blacklist_entries
    DROP CONSTRAINT IF EXISTS blacklist_entries_source_type_check;

ALTER TABLE blacklist_entries
    ADD CONSTRAINT blacklist_entries_source_type_check
    CHECK (source_type IN ('gmail', 'chatwork', 'line', 'slack'));

COMMENT ON TABLE slack_installations IS 'Slack OAuth installations per LINE user and workspace';
COMMENT ON COLUMN slack_installations.user_access_token IS 'Slack user token used for replying as the connected user';
COMMENT ON COLUMN slack_installations.bot_access_token IS 'Slack bot token used for event and workspace level operations';
