import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  CoverLetterDraft,
  CvDraft,
} from "@/lib/intelligence/drafts";
import type { DocumentTemplate } from "@/lib/data/types";

/**
 * ATS-friendly PDF templates (Prompt 8): single column, real selectable
 * text, standard headings, no tables, icons or images, A4. Two base
 * templates: "BI and commercial" and "Risk and research".
 */

const ACCENTS: Record<DocumentTemplate, { color: string; font: string }> = {
  bi_commercial: { color: "#4f46e5", font: "Helvetica-Bold" },
  risk_research: { color: "#1f2937", font: "Times-Bold" },
};

function styles(template: DocumentTemplate) {
  const accent = ACCENTS[template];
  return StyleSheet.create({
    page: {
      padding: 48,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#1f2937",
      lineHeight: 1.45,
    },
    name: {
      fontSize: 18,
      fontFamily: accent.font,
      color: accent.color,
      marginBottom: 2,
    },
    contact: { fontSize: 9, color: "#6b7280", marginBottom: 12 },
    heading: {
      fontSize: 11,
      fontFamily: accent.font,
      color: accent.color,
      marginTop: 12,
      marginBottom: 4,
      borderTopWidth: 0.5,
      borderTopColor: "#d6d3d1",
      paddingTop: 6,
    },
    role: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#111827" },
    meta: { fontSize: 9, color: "#6b7280", marginBottom: 3 },
    bullet: { flexDirection: "row", marginBottom: 2 },
    bulletDot: { width: 10 },
    bulletText: { flex: 1 },
    skillLine: { marginBottom: 2 },
    paragraph: { marginBottom: 8 },
    label: {
      fontSize: 8,
      color: "#9ca3af",
      marginTop: 16,
      borderTopWidth: 0.5,
      borderTopColor: "#e7e5e4",
      paddingTop: 4,
    },
  });
}

type PdfMeta = {
  fullName: string;
  contactLine: string;
  jobTitle: string;
  company: string;
};

function CvDocument({
  draft,
  meta,
  template,
}: {
  draft: CvDraft;
  meta: PdfMeta;
  template: DocumentTemplate;
}) {
  const s = styles(template);
  return (
    <Document
      title={`CV - ${meta.fullName} - ${meta.jobTitle} - ${meta.company}`}
      author={meta.fullName}
    >
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{meta.fullName}</Text>
        {meta.contactLine ? <Text style={s.contact}>{meta.contactLine}</Text> : null}

        <Text style={s.heading}>Summary</Text>
        <Text>{draft.summary.text}</Text>

        {draft.skills.length > 0 ? (
          <>
            <Text style={s.heading}>Skills</Text>
            {draft.skills.map((skill, i) => (
              <Text key={i} style={s.skillLine}>
                {skill.text}
              </Text>
            ))}
          </>
        ) : null}

        {draft.experience.length > 0 ? (
          <Text style={s.heading}>Experience</Text>
        ) : null}
        {draft.experience.map((section, i) => (
          <View key={`e${i}`} wrap={false}>
            <Text style={s.role}>{section.heading}</Text>
            {section.bullets.map((bullet, j) => (
              <View key={j} style={s.bullet}>
                <Text style={s.bulletDot}>-</Text>
                <Text style={s.bulletText}>{bullet.text}</Text>
              </View>
            ))}
          </View>
        ))}

        {draft.projects.length > 0 ? (
          <Text style={s.heading}>Projects</Text>
        ) : null}
        {draft.projects.map((section, i) => (
          <View key={`p${i}`} wrap={false}>
            <Text style={s.role}>{section.heading}</Text>
            {section.bullets.map((bullet, j) => (
              <View key={j} style={s.bullet}>
                <Text style={s.bulletDot}>-</Text>
                <Text style={s.bulletText}>{bullet.text}</Text>
              </View>
            ))}
          </View>
        ))}

        {draft.education.length > 0 ? (
          <Text style={s.heading}>Education</Text>
        ) : null}
        {draft.education.map((item, i) => (
          <View key={`d${i}`} wrap={false}>
            <Text style={s.role}>{item.heading}</Text>
            <Text style={s.meta}>{item.detail}</Text>
          </View>
        ))}

        <Text style={s.label}>
          Tailored with Career Desk for {meta.jobTitle}
          {meta.company ? ` at ${meta.company}` : ""}.
        </Text>
      </Page>
    </Document>
  );
}

function CoverLetterDocument({
  draft,
  meta,
  template,
}: {
  draft: CoverLetterDraft;
  meta: PdfMeta;
  template: DocumentTemplate;
}) {
  const s = styles(template);
  return (
    <Document
      title={`Cover letter - ${meta.fullName} - ${meta.jobTitle} - ${meta.company}`}
      author={meta.fullName}
    >
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{meta.fullName}</Text>
        {meta.contactLine ? <Text style={s.contact}>{meta.contactLine}</Text> : null}

        <Text style={s.role}>
          Application: {meta.jobTitle}
          {meta.company ? ` - ${meta.company}` : ""}
        </Text>
        <Text style={s.heading}>&nbsp;</Text>
        <Text style={s.paragraph}>{draft.greeting}</Text>
        {draft.paragraphs.map((paragraph, i) => (
          <Text key={i} style={s.paragraph}>
            {paragraph.text}
          </Text>
        ))}
        <Text style={s.paragraph}>{draft.closing}</Text>
      </Page>
    </Document>
  );
}

export async function renderCvPdf(
  draft: CvDraft,
  meta: PdfMeta,
  template: DocumentTemplate,
): Promise<Buffer> {
  return renderToBuffer(<CvDocument draft={draft} meta={meta} template={template} />);
}

export async function renderCoverLetterPdf(
  draft: CoverLetterDraft,
  meta: PdfMeta,
  template: DocumentTemplate,
): Promise<Buffer> {
  return renderToBuffer(
    <CoverLetterDocument draft={draft} meta={meta} template={template} />,
  );
}
