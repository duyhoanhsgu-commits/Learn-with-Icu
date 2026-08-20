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
