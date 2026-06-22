import { useEffect, useState } from "react";
import { useLanguage } from "@/features/i18n/language-provider";
import type { SkillsPageData } from "@/features/dashboard/data";

interface SkillEditorProps {
  readonly assignedAgentCount: number;
  readonly assignedAgents: SkillsPageData["agents"];
  readonly file: SkillsPageData["skills"][number]["files"][number];
  readonly pending: boolean;
  readonly skill: SkillsPageData["skills"][number];
  readonly onDeleteSkill: () => void;
  readonly onSaveSkill: (input: { name: string; content: string }) => void;
}

export function SkillEditor({
  assignedAgentCount,
  assignedAgents,
  file,
  pending,
  skill,
  onDeleteSkill,
  onSaveSkill,
}: SkillEditorProps) {
  const { tx } = useLanguage();
  const [nameDraft, setNameDraft] = useState(skill.name);
  const [contentDraft, setContentDraft] = useState(file.content);

  useEffect(() => {
    setNameDraft(skill.name);
  }, [skill.id, skill.name]);

  useEffect(() => {
    setContentDraft(file.content);
  }, [file.id, file.content]);

  const isSkillDirty = nameDraft !== skill.name || contentDraft !== file.content;

  return (
    <div className="skills-editor">
      <div className="skills-editor__header">
        <div className="skills-editor__identity">
          <div className="skills-editor__icon">✦</div>
          <div className="skills-editor__meta">
            <input
              className="skill-editor-input skill-editor-input--title"
              disabled={skill.isBuiltin}
              onChange={(event) => setNameDraft(event.currentTarget.value)}
              placeholder="Skill name"
              type="text"
              value={nameDraft}
            />
          </div>
        </div>
        <div className="skills-editor__actions">
          <button className="modal-secondary-button" disabled={pending || skill.isBuiltin} onClick={onDeleteSkill} type="button">
            {tx("删除 Skill", "Delete skill")}
          </button>
          <button
            className="primary-button"
            disabled={pending || skill.isBuiltin || nameDraft.trim().length === 0 || !isSkillDirty}
            onClick={() => onSaveSkill({ name: nameDraft, content: contentDraft })}
            type="button"
          >
            {tx("保存 Skill", "Save skill")}
          </button>
        </div>
      </div>

      <textarea
        className="skills-editor__textarea"
        disabled={skill.isBuiltin}
        onChange={(event) => setContentDraft(event.currentTarget.value)}
        placeholder={tx("编辑文件内容", "Edit file content")}
        rows={24}
        value={contentDraft}
      />

      <div className="skills-editor__assigned">
        <div>
          <p className="skills-editor__assigned-label">{tx("已绑定 Agents", "Assigned agents")}</p>
          <strong>{tx(`${assignedAgentCount} 个 Agent 正在使用这份 skill`, `${assignedAgentCount} agents are using this skill`)}</strong>
        </div>
        <div className="skills-editor__assigned-list">
          {assignedAgents.length > 0 ? (
            assignedAgents.map((agent) => (
              <span className="skills-editor__assigned-pill" key={agent.id}>
                {agent.name}
              </span>
            ))
          ) : (
            <span className="skills-editor__assigned-pill skills-editor__assigned-pill--muted">{tx("还没有 Agent 绑定", "No agents assigned yet")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
