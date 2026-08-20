export const modules = [
  { name: 'Intro to Algorithms', progress: 7, total: 12 },
  { name: 'Academic Writing', progress: 3, total: 8 },
  { name: 'Statistics Basics', progress: 9, total: 10 },
]

export const sessions = [
  { id: 'recursion', title: 'Why does recursion need a base case?', subject: 'Computer Science', time: 'Just now', messages: [{ id: 1, role: 'assistant', content: 'Hi Mina — good to see you back.\n\nYou left off on recursion in Intro to Algorithms. Want to pick that up, or start something new?' }] },
  { id: 'economics', title: 'Explaining supply and demand shifts', subject: 'Economics', time: '2h ago', messages: [{ id: 1, role: 'assistant', content: 'Welcome back, Mina. We were looking at how changes in supply and demand move market equilibrium. What would you like to clarify?' }] },
  { id: 'biology', title: 'Photosynthesis, light vs dark reactions', subject: 'Biology', time: 'Yesterday', messages: [{ id: 1, role: 'assistant', content: 'Ready to continue with photosynthesis? We can compare the light-dependent reactions with the Calvin cycle.' }] },
  { id: 'history', title: 'Essay outline: Meiji Restoration', subject: 'History', time: 'Mon', messages: [{ id: 1, role: 'assistant', content: 'Your Meiji Restoration outline has a strong thesis. Shall we develop the evidence for your first body paragraph?' }] },
  { id: 'calculus', title: 'Practice set — derivatives', subject: 'Calculus', time: 'Last week', messages: [{ id: 1, role: 'assistant', content: 'Let’s continue your derivative practice. Would you prefer the chain rule, product rule, or a mixed set?' }] },
]

export const suggestedPrompts = [
  'Explain recursion like I am five',
  'Quiz me on cell biology',
  'Help me outline an argumentative essay',
  'Break down this calculus problem step by step',
]

export const assistantReply = 'Think of recursion like opening a box that contains a smaller version of the same box.\n\nEach step solves a smaller version of the original problem.\n\nThe base case tells the function when to stop opening boxes.'

export const generalPrompts = [
  'Explain recursion simply',
  'Teach me how neural networks work',
  'Quiz me about Python',
  'Explain RAG step by step',
]

export const filePrompts = [
  'Summarize this document',
  'Explain this document simply',
  'Quiz me on this document',
  'What are the key concepts?',
  'Create practice questions',
]

export const initialFiles = [
  { id: 'file-1', name: 'recursion-and-algorithms.pdf', type: 'pdf', size: '2.4 MB', status: 'ready' },
  { id: 'file-2', name: 'machine-learning-notes.pdf', type: 'pdf', size: '4.1 MB', status: 'ready' },
  { id: 'file-3', name: 'lecture-week-03.docx', type: 'docx', size: '850 KB', status: 'ready' },
]

export const initialLearningSpaces = [
  { id: 'space-algorithms', name: 'Algorithms', color: 'teal', files: [
    { id: 'file-1', name: 'recursion-and-algorithms.pdf', type: 'pdf', size: '2.4 MB', status: 'ready' },
    { id: 'file-2', name: 'sorting-and-searching.pdf', type: 'pdf', size: '1.8 MB', status: 'ready' },
  ] },
  { id: 'space-machine-learning', name: 'Machine Learning', color: 'violet', files: [
    { id: 'file-3', name: 'machine-learning-notes.pdf', type: 'pdf', size: '4.1 MB', status: 'ready' },
    { id: 'file-4', name: 'lecture-week-03.docx', type: 'docx', size: '850 KB', status: 'ready' },
  ] },
  { id: 'space-writing', name: 'Academic Writing', color: 'amber', files: [
    { id: 'file-5', name: 'argumentative-essay-guide.pdf', type: 'pdf', size: '1.2 MB', status: 'ready' },
  ] },
]
