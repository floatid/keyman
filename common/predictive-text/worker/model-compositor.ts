/// <reference path="../node_modules/@keymanapp/models-templates/src/index.ts" />
/// <reference path="correction/context-tracker.ts" />

class ModelCompositor {
  private lexicalModel: LexicalModel;
  private contextTracker?: correction.ContextTracker;
  private static readonly MAX_SUGGESTIONS = 12;
  private readonly punctuation: LexicalModelPunctuation;

  constructor(lexicalModel: LexicalModel) {
    this.lexicalModel = lexicalModel;
    if(lexicalModel.traverseFromRoot) {
      this.contextTracker = new correction.ContextTracker();
    }
    this.punctuation = ModelCompositor.determinePunctuationFromModel(lexicalModel);
  }

  protected isWhitespace(transform: Transform): boolean {
    // Matches prefixed text + any instance of a character with Unicode general property Z* or the following: CR, LF, and Tab.
    let whitespaceRemover = /.*[\u0009\u000A\u000D\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u202f\u205f\u3000]/i;
    
    // Filter out null-inserts; their high probability can cause issues.
    if(transform.insert == '') { // Can actually register as 'whitespace'.
      return false;
    }

    let insert = transform.insert;

    insert = insert.replace(whitespaceRemover, '');

    return insert == '';
  }

  protected isBackspace(transform: Transform): boolean {
    return transform.insert == "" && transform.deleteLeft > 0;
  }

  protected isEmpty(transform: Transform): boolean {
    return transform.insert == '' && transform.deleteLeft == 0;
  }

  private predictFromCorrections(corrections: ProbabilityMass<Transform>[], context: Context): Distribution<Suggestion> {
    let punctuation = this.punctuation;
    let returnedPredictions: Distribution<Suggestion> = [];

    for(let correction of corrections) {
      let predictions = this.lexicalModel.predict(correction.sample, context);

      let predictionSet = predictions.map(function(pair: ProbabilityMass<Suggestion>) {
        let transform = correction.sample;
        let inputProb = correction.p;
        // Let's not rely on the model to copy transform IDs.
        // Only bother is there IS an ID to copy.
        if(transform.id !== undefined) {
          pair.sample.transformId = transform.id;
        }

        let preserveWhitespace: boolean = false;
        if(this.isWhitespace(transform)) {
          // Detect start of new word; prevent whitespace loss here.
          let postContext = models.applyTransform(transform, context);
          preserveWhitespace = (this.lexicalModel.wordbreak(postContext) == '');
        }

        // Prepends the original whitespace, ensuring it is preserved if
        // the suggestion is accepted.
        if(preserveWhitespace) {
          models.prependTransform(pair.sample.transform, transform);
        }
        
        // The model is trying to add a word; thus, add some custom formatting
        // to that word.
        if (pair.sample.transform.insert.length > 0) {
          pair.sample.transform.insert += punctuation.insertAfterWord;
        }

        let prediction = {sample: pair.sample, p: pair.p * inputProb};
        return prediction;
      }, this);

      returnedPredictions = returnedPredictions.concat(predictionSet);
    }

    return returnedPredictions;
  }

  predict(transformDistribution: Transform | Distribution<Transform>, context: Context): Suggestion[] {
    let suggestionDistribution: Distribution<Suggestion> = [];
    let lexicalModel = this.lexicalModel;
    let punctuation = this.punctuation;

    if(!(transformDistribution instanceof Array)) {
      transformDistribution = [ {sample: transformDistribution, p: 1.0} ];
    }

    // Find the transform for the actual keypress.
    let inputTransform = transformDistribution.sort(function(a, b) {
      return b.p - a.p;
    })[0].sample;

    // Only allow new-word suggestions if space was the most likely keypress.
    let allowSpace = this.isWhitespace(inputTransform);
    let allowBksp = this.isBackspace(inputTransform);

    let postContext = models.applyTransform(inputTransform, context);
    let keepOptionText = this.lexicalModel.wordbreak(postContext);
    let keepOption: Suggestion = null;

    let predictionRoots: ProbabilityMass<Transform>[]
    let rawPredictions: Distribution<Suggestion> = [];

    // Section 1:  determining 'prediction roots'.

    if(!this.contextTracker) {
      // Generates raw prediction distributions for each valid input.  Can only 'correct'
      // against the final input.
      //
      // This is the old, 12.0-13.0 'correction' style.
      predictionRoots = transformDistribution.map(function(alt) {
        let transform = alt.sample;

        // Filter out special keys unless they're expected.
        if(this.isWhitespace(transform) && !allowSpace) {
          return null;
        } else if(this.isBackspace(transform) && !allowBksp) {
          return null;
        }

        return alt;
      }, this);

      // Remove `null` entries.
      predictionRoots = predictionRoots.filter(tuple => !!tuple);

      // Running in bulk over all suggestions, duplicate entries may be possible.
      rawPredictions = this.predictFromCorrections(predictionRoots, context);
    } else {
      let contextState = this.contextTracker.analyzeState(this.lexicalModel, 
                                                          postContext, 
                                                          !this.isEmpty(inputTransform) ? 
                                                                        transformDistribution: 
                                                                        [{sample: inputTransform, p: 1.0}]
                                                          );

      // TODO:  Should we filter backspaces & whitespaces out of the transform distribution?
      //        Ideally, the answer (in the future) will be no, but leaving it in right now may pose an issue.
      
      // Rather than go "full hog" and make a priority queue out of the eventual, future competing search spaces...
      // let's just note that right now, there will only ever be one.
      //
      // The 'eventual' logic will be significantly more complex, though still manageable.
      let searchSpace = contextState.searchSpace[0];

      // TODO:  whitespace, backspace filtering.  Do it here.
      //        Whitespace is probably fine, actually.  Less sure about backspace.

      let bestCorrectionCost: number;
      for(let matches of searchSpace.getBestMatches()) {
        // Corrections obtained:  now to predict from them!
        let predictionRoots = matches.map(function(match) {
          let correction = match.matchString;
          
          // Worth considering:  extend Traversal to allow direct prediction lookups?
          // let traversal = match.finalTraversal;

          // Find a proper Transform ID to map the correction to.
          // Without it, we can't apply the suggestion.
          let finalInput: Transform;
          if(match.inputSequence.length > 0) {
            finalInput = match.inputSequence[match.inputSequence.length - 1].sample;
          } else {
            finalInput = inputTransform;  // A fallback measure.  Greatly matters for empty contexts.
          }

          // Replace the existing context with the correction.
          let correctionTransform: Transform = {
            insert: correction,  // insert correction string
            deleteLeft: lexicalModel.wordbreak(context).length, // remove actual token string
            id: finalInput.id
          }

          if(bestCorrectionCost === undefined) {
            bestCorrectionCost = match.totalCost;
          }

          return {
            sample: correctionTransform,
            p: Math.exp(-match.totalCost)
          };
        }, this);

        // Running in bulk over all suggestions, duplicate entries may be possible.
        let predictions = this.predictFromCorrections(predictionRoots, context);
        rawPredictions = rawPredictions.concat(predictions);

        // TODO:  We don't currently de-duplicate predictions at this point quite yet, so
        // it's technically possible that we return too few.

        if(rawPredictions.length >= ModelCompositor.MAX_SUGGESTIONS) {
          break;
        } else if(matches[0].totalCost >= bestCorrectionCost + 4) { // e^-4 = 0.0183156388.  Allows "80%" of an extra edit.
          // Very useful for stopping 'sooner' when words reach a sufficient length.
          break;
        }
      }
    }

    // Section 2 - post-analysis for our generated predictions, managing 'keep'.

    // Assumption:  Duplicated 'displayAs' properties indicate duplicated Suggestions.
    // When true, we can use an 'associative array' to de-duplicate everything.
    let suggestionDistribMap: {[key: string]: ProbabilityMass<Suggestion>} = {};

    // Deduplicator + annotator of 'keep' suggestions.
    for(let prediction of rawPredictions) {
      // Combine duplicate samples.
      let displayText = prediction.sample.displayAs;

      if(displayText == keepOptionText || (lexicalModel.toKey && displayText == lexicalModel.toKey(keepOptionText)) ) {
        keepOption = prediction.sample;
        // Ensure we keep any original casing, etc that may have been stripped.
        keepOption.transform.insert = keepOptionText + punctuation.insertAfterWord;
        keepOption.displayAs = keepOptionText;
        // Specifying 'keep' helps uses of the LMLayer find it quickly
        // if/when desired.
        keepOption.tag = 'keep';
      } else {
        let existingSuggestion = suggestionDistribMap[displayText];
        if(existingSuggestion) {
          existingSuggestion.p += prediction.p;
        } else {
          suggestionDistribMap[displayText] = prediction;
        }
      }
    }

    // Generate a default 'keep' option if one was not otherwise produced.
    if(!keepOption && keepOptionText != '') {
      keepOption = {
        displayAs: keepOptionText,
        transformId: inputTransform.id,
        // Replicate the original transform, modified for appropriate language insertion syntax.
        transform: {
          insert: inputTransform.insert + punctuation.insertAfterWord,
          deleteLeft: inputTransform.deleteLeft,
          deleteRight: inputTransform.deleteRight,
          id: inputTransform.id
        },
        tag: 'keep'
      };
    }

    // Add the surrounding quotes to the "keep" option's display string:
    if (keepOption) {
      let { open, close } = punctuation.quotesForKeepSuggestion;
      
      // Should we also ensure that we're using the default quote marks first?
      // Or is it reasonable to say that the "left" mark is always the one
      // called "open"?
      if(!punctuation.isRTL) {
        keepOption.displayAs = open + keepOption.displayAs + close;
      } else {
        keepOption.displayAs = close + keepOption.displayAs + open;
      }
    }

    // Section 3:  Finalize suggestions, truncate list to the N (MAX_SUGGESTIONS) most optimal, return.

    // Now that we've calculated a unique set of probability masses, time to make them into a proper
    // distribution and prep for return.
    for(let key in suggestionDistribMap) {
      let pair = suggestionDistribMap[key];
      suggestionDistribution.push(pair);
    }

    suggestionDistribution = suggestionDistribution.sort(function(a, b) {
      return b.p - a.p; // Use descending order - we want the largest probabilty suggestions first!
    });

    let suggestions = suggestionDistribution.splice(0, ModelCompositor.MAX_SUGGESTIONS).map(function(value) {
      if(value.sample['p']) {
        // For analysis / debugging
        value.sample['lexical-p'] =  value.sample['p'];
        value.sample['correction-p'] = value.p / value.sample['p'];
        // Use of the Trie model always exposed the lexical model's probability for a word to KMW.
        // It's useful for debugging right now, so may as well repurpose it as the posterior.
        //
        // We still condition on 'p' existing so that test cases aren't broken.
        value.sample['p'] = value.p;
      }
      return value.sample;
    });

    if(keepOption) {
      suggestions = [ keepOption ].concat(suggestions);
    }

    return suggestions;
  }

  /**
   * Returns the punctuation used for this model, filling out unspecified fields
   */
  private static determinePunctuationFromModel(model: LexicalModel): LexicalModelPunctuation {
    let defaults = DEFAULT_PUNCTUATION;

    // Use the defaults of the model does not provide any punctuation at all.
    if (!model.punctuation)
      return defaults;

    let specifiedPunctuation = model.punctuation;
    let insertAfterWord = specifiedPunctuation.insertAfterWord;
    if (insertAfterWord !== '' && !insertAfterWord) {
      insertAfterWord = defaults.insertAfterWord;
    }

    let quotesForKeepSuggestion = specifiedPunctuation.quotesForKeepSuggestion;
    if (!quotesForKeepSuggestion) {
      quotesForKeepSuggestion = defaults.quotesForKeepSuggestion;
    }

    let isRTL = specifiedPunctuation.isRTL;
    // Default:  false / undefined, so no need to directly specify it.

    return {
      insertAfterWord, quotesForKeepSuggestion, isRTL
    }
  }
}

/**
 * The default punctuation and spacing produced by the model.
 */
const DEFAULT_PUNCTUATION: LexicalModelPunctuation = {
  quotesForKeepSuggestion: { open: `“`, close: `”`},
  insertAfterWord: " " ,
};
