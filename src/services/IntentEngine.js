import StorageService from './StorageService.js';

class IntentEngine {
  static parseIntent(text) {
    const lowerText = text.toLowerCase().trim();
    
    // 1. Mood Detection
    if (lowerText.match(/(?:tired|exhausted|stress|hard|can\'t do this|give up|bored|sad)/)) {
      return { type: 'mood', originalText: text };
    }

    // 2. Dash/Stats Detection
    if (lowerText.match(/(dashboard|stats|progress|level|xp|rank)/)) {
      return { type: 'dashboard', originalText: text };
    }

    // 3. Quiz Intent
    const quizPatterns = [
      /(?:quiz|test|exam|evaluate) me on (.+)/,
      /(?:start|give me) a (?:quiz|test) on (.+)/,
      /(?:quiz|test) about (.+)/
    ];
    for (const p of quizPatterns) {
      const match = lowerText.match(p);
      if (match) return { type: 'quiz', topic: match[1].trim(), originalText: text };
    }
    if (lowerText.includes('quiz') || lowerText.includes('test')) {
       const topic = lowerText.replace(/(quiz|test|start|give|me|on|about)/g, '').trim();
       if (topic) return { type: 'quiz', topic, originalText: text };
    }

    // 4. Notes/Summary Intent
    const notePatterns = [
      /(?:notes|summary|summarize) on (.+)/,
      /(?:give me|generate) (?:notes|summary) for (.+)/,
      /(?:summarize|short notes on) (.+)/
    ];
    for (const p of notePatterns) {
      const match = lowerText.match(p);
      if (match) return { type: 'notes', topic: match[1].trim(), originalText: text };
    }
    if (lowerText.includes('notes') || lowerText.includes('summary') || lowerText.includes('summarize')) {
       const topic = lowerText.replace(/(notes|summary|summarize|give|me|on|for|short)/g, '').trim();
       if (topic) return { type: 'notes', topic, originalText: text };
    }

    // 5. Explanation Intent
    const explainPatterns = [
      /(?:explain|teach|what is|how does|tell me about) (.+)/,
      /(?:definition of|define) (.+)/
    ];
    for (const p of explainPatterns) {
      const match = lowerText.match(p);
      if (match) {
        const topic = match[1].trim();
        let level = 'intermediate';
        if (lowerText.includes('like i\'m 5') || lowerText.includes('simple') || lowerText.includes('eli5')) level = 'simple';
        if (lowerText.includes('beginner') || lowerText.includes('basic')) level = 'beginner';
        if (lowerText.includes('expert') || lowerText.includes('advanced') || lowerText.includes('detailed')) level = 'expert';
        if (lowerText.includes('exam')) level = 'exam';
        
        return { type: 'explain', topic, level, originalText: text };
      }
    }

    // 6. Special Learning Modes
    if (lowerText.includes('exam survival') || lowerText.includes('crash course')) return { type: 'survival', originalText: text };
    if (lowerText.includes('passive learning') || lowerText.includes('read to me')) return { type: 'passive', originalText: text };
    if (lowerText.includes('teach back') || lowerText.includes('let me explain')) {
        const topicMatch = lowerText.match(/(?:explain|about) (.+)/);
        return { type: 'teachback', topic: topicMatch ? topicMatch[1] : 'this topic', originalText: text };
    }

    // 7. Industry / Real-World Detection
    if (lowerText.match(/(?:where is this used|real world|industry|practical application|career|use case)/)) {
      const topicMatch = lowerText.match(/(?:of|for|about) (.+)/) || lowerText.match(/(?:explain|at) (.+)/);
      return { type: 'industry', topic: topicMatch ? topicMatch[1] : 'this topic', originalText: text };
    }

    // If we have a generic "what is X" but no trigger, try to extract whatever word follows a common question
    const genericTopic = lowerText.split(' ').pop();
    return { type: 'explain', topic: genericTopic, originalText: text, isFallback: true };
  }

  static generateResponse(intent) {
    const settings = StorageService.getSettings();
    const style = intent.level || settings.learning.style;

    if (intent.type === 'mood') {
      return `I sense you're feeling a bit low. Don't worry! Every step forward counts. Let's take it easy—maybe start with a short summary or just listen to some explanations? You've got this!`;
    }

    const topic = intent.topic || "this topic";

    switch (intent.type) {
      case 'explain':
        return this.mockExplanation(topic, style);
      case 'notes':
        return `I've generated comprehensive notes for **${topic}**. I'm also saving these to your Notebook so you can review them later! \n\n### ${topic} Summary\n- Key Definition: Fundamental building block of this domain.\n- Important Concept: Enhances efficiency and provides deep structural integrity.\n- Core Application: Utilized in 90% of real-world scenarios.`;
      case 'quiz':
        return `Scanning my database for **${topic}** questions... Ready! Let's see how much you know.`;
      case 'dashboard':
        return `Switching to your dashboard view. You're currently level **${StorageService.getDashboardStats().level}**!`;
      case 'industry':
        return `<div class="sum-card" style="border-top-color:#005cbf; background:rgba(0,0,0,0.2)">
          <div class="card-label" style="color:#00bfff">🏭 Real-World Application: ${topic}</div>
          <div style="font-size:13px; line-height:1.6">
            ${topic} is the backbone of major modern industries. Here is how it's used today:
            <ul style="margin-top:10px; padding-left:20px">
              <li><b>Tech Giants (Google/Amazon):</b> Used to manage large-scale data integrity and ensure high availability for billions of users.</li>
              <li><b>FinTech:</b> Critical for securing transactions and preventing fraud in real-time banking systems.</li>
              <li><b>Automation:</b> Employed in Tesla's autopilot and robotics to handle complex decision-making loops.</li>
            </ul>
            <div style="margin-top:12px; font-style:italic; color:var(--text3); font-size:11.5px">💡 Mastering this topic prepares you for roles in DevOps, Backend Engineering, and Data Science.</div>
          </div>
        </div>`;
      case 'survival':
        return `Activating **Exam Survival Mode**. I've prioritized the most important formulas and definitions for your review.`;
      case 'passive':
        return `Starting **Passive Learning Mode**. Sit back and relax, I'll read the most important concepts to you.`;
      default:
        return intent.isFallback ? 
          `I wasn't 100% sure about the intent, but assuming you want an explanation for **${topic}**: It's a key concept in your study material!` : 
          `I'm your EduVox assistant. You can ask me to **explain** something, **generate notes**, or **quiz you** on a specific topic!`;
    }
  }

  static mockExplanation(topic, style) {
    if (style === 'simple') return `<strong>Simplifying "${topic}" (ELI5):</strong><br>Imagine ${topic} is like a pizza delivery system. You ask for something, and it gets delivered step-by-step without you needing to know how the oven works! It's all about making complex things much easier to handle.`;
    if (style === 'expert') return `<strong>Deep Dive: ${topic} (Advanced Context):</strong><br>${topic} involves multi-layered architectural patterns including low-level optimization, concurrent execution threads, and distributed state management. In a production environment, this is critical for ensuring sub-millisecond latency.`;
    if (style === 'exam') return `<strong>Exam Focus: ${topic}</strong><br>Key pointers for your exam:<br>• Definition: Core utility of ${topic}.<br>• Critical Components: Scalability and Robustness.<br>• Common Question: "How does ${topic} handle edge cases?"`;
    if (style === 'bullet') return `**${topic}** Key Points:\n• Fundamental principle.\n• Critical for system design.\n• Requires baseline knowledge of the domain.`;
    return `**${topic}** is a sophisticated concept involving several layers of abstraction. To master it, one must understand both the theoretical underpinnings and the practical implementations that drive its effectiveness.`;
  }
}

export default IntentEngine;
