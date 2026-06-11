/** Re-exports for the know step — trade-aware topics live in train-cara-trade-topics. */

export type {
  CaraKnowledgeCollected,
  TradeKnowledgeTopicId,
  TradeKnowledgeTopicId as CaraKnowledgeChecklistId,
} from "./train-cara-trade-topics";

export {
  getTradeKnowledgeTopics,
  isKnowledgeCollectionComplete,
  isTradeTopicSatisfied,
  nextMissingTradeTopic as nextMissingChecklistItem,
  tradeTopicIdsForType,
} from "./train-cara-trade-topics";
