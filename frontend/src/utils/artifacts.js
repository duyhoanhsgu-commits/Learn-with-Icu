const FENCE_PATTERN = /```([^\n`]*)\n?([\s\S]*?)```/g

const LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  tex: 'latex',
  math: 'latex',
  htm: 'html',
  txt: 'text',
  plaintext: 'text',
}

const normalizeLanguage = (value = '') => {
  const language = value.trim().toLowerCase().split(/\s+/)[0]
  return LANGUAGE_ALIASES[language] || language
}

function isJson(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object'
  } catch {
    return false
  }
}

function inferType(language, content) {
  if (language === 'html') return 'html'
  if (language === 'mermaid') return 'mermaid'
  if (language === 'json' || language === 'jsonc') return 'json'
  if (language === 'latex') return 'latex'
  if (language === 'markdown') return 'markdown'
  if (language === 'text') return 'text'
  if (language) return 'code'

  const trimmed = content.trim()
  if (isJson(trimmed)) return 'json'
  if (/^(?:<!doctype\s+html|<html\b|<body\b|<(?:div|main|section|article|svg)\b)/i.test(trimmed)) return 'html'
  if (/^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|gitGraph)\b/m.test(trimmed)) return 'mermaid'
  if (/\\begin\{|\\(?:frac|sum|int|sqrt|mathbf)\b/.test(trimmed)) return 'latex'
  return 'code'
}

const titleFor = (type, language, index) => {
  const labels = {
    markdown: 'Markdown preview',
    code: language ? `${language.toUpperCase()} code` : 'Code',
    html: 'HTML preview',
    latex: 'LaTeX',
    mermaid: 'Mermaid diagram',
    json: 'JSON data',
    text: 'Text preview',
  }
  return `${labels[type] || 'Artifact'}${index > 0 ? ` ${index + 1}` : ''}`
}

export function extractArtifacts(content = '', messageId = 'message') {
  const artifacts = []
  let match
  let blockIndex = 0
  let prose = ''
  let cursor = 0
  FENCE_PATTERN.lastIndex = 0

  while ((match = FENCE_PATTERN.exec(content))) {
    prose += content.slice(cursor, match.index)
    cursor = FENCE_PATTERN.lastIndex
    const language = normalizeLanguage(match[1])
    const raw = match[2].trim()
    if (!raw) continue
    const type = inferType(language, raw)
    artifacts.push({
      id: `${messageId}-artifact-${blockIndex}`,
      type,
      language: language || (type === 'code' ? 'text' : type),
      title: titleFor(type, language, blockIndex),
      content: raw,
    })
    blockIndex += 1
  }
  prose += content.slice(cursor)

  const latexPattern = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g
  let latexMatch
  while ((latexMatch = latexPattern.exec(prose))) {
    const raw = (latexMatch[1] || latexMatch[2] || '').trim()
    if (!raw) continue
    const index = artifacts.length
    artifacts.push({
      id: `${messageId}-artifact-latex-${index}`,
      type: 'latex',
      language: 'latex',
      title: titleFor('latex', 'latex', index),
      content: raw,
    })
  }

  return artifacts
}

export function formatJsonArtifact(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

export function isRunnableArtifact(artifact) {
  if (!artifact) return false
  if (artifact.type === 'html') return true
  if (artifact.type !== 'code') return false
  return ['javascript', 'js', 'css'].includes(artifact.language)
}
