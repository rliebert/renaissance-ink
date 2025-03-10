import { Router } from 'express';
import { db } from '../db';
import { animations, insertAnimationSchema } from '@shared/schema';
import { generateAnimation } from '../services/openai';
import { eq } from 'drizzle-orm';
import { extractSelectedElements } from '../services/openai';

const router = Router();

// Get preview of selected elements
router.post('/preview', async (req, res) => {
  try {
    const { svgContent, selectedElements = [], referenceElements = [] } = req.body;
    const allElements = [...selectedElements, ...referenceElements];
    const previewSvg = extractSelectedElements(svgContent, allElements);
    res.json({ preview: previewSvg });
  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(400).json({ error: 'Failed to generate preview' });
  }
});

// Create a new animation
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const parsedBody = insertAnimationSchema.parse(req.body);
    const { loop = true } = req.body; // Extract loop parameter with default true

    // Generate initial animation
    const animationResult = await generateAnimation({
      svgContent: parsedBody.originalSvg,
      selectedElements: parsedBody.selectedElements || [],
      referenceElements: parsedBody.referenceElements || [],
      description: parsedBody.description,
      parameters: parsedBody.parameters,
      loop, // Pass loop parameter to animation generator
    });

    // Insert into database
    const [animation] = await db.insert(animations).values({
      ...parsedBody,
      animatedSvg: animationResult.animatedSvg,
      parameters: animationResult.suggestedParams,
      conversation: [{
        role: 'user',
        content: parsedBody.description,
        timestamp: new Date()
      }, {
        role: 'assistant',
        content: animationResult.explanation,
        timestamp: new Date()
      }]
    }).returning();

    res.json(animation);
  } catch (error: unknown) {
    console.error('Error creating animation:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: errorMessage });
  }
});

// Update existing animation
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { description, parameters, loop = true } = req.body;

    // Get existing animation
    const [existingAnimation] = await db
      .select()
      .from(animations)
      .where(eq(animations.id, id));

    if (!existingAnimation) {
      return res.status(404).json({ error: 'Animation not found' });
    }

    // Generate updated animation
    const animationResult = await generateAnimation({
      svgContent: existingAnimation.originalSvg,
      selectedElements: existingAnimation.selectedElements || [],
      referenceElements: existingAnimation.referenceElements || [],
      description,
      parameters,
      conversation: existingAnimation.conversation || [],
      loop, // Pass loop parameter
    });

    // Update animation
    const [updatedAnimation] = await db
      .update(animations)
      .set({
        animatedSvg: animationResult.animatedSvg,
        parameters: animationResult.suggestedParams,
        conversation: [
          ...(existingAnimation.conversation || []),
          {
            role: 'user',
            content: description,
            timestamp: new Date()
          },
          {
            role: 'assistant',
            content: animationResult.explanation,
            timestamp: new Date()
          }
        ]
      })
      .where(eq(animations.id, id))
      .returning();

    res.json(updatedAnimation);
  } catch (error: unknown) {
    console.error('Error updating animation:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: errorMessage });
  }
});

export default router;