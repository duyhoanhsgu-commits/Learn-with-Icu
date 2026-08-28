"""Async state machine for the incremental Research Agent pipeline."""

import asyncio

from src.agent.research.nodes.extract import EvidenceExtractor
from src.agent.research.nodes.evaluate import ResearchEvaluator
from src.agent.research.nodes.planner import ResearchPlanner
from src.agent.research.nodes.retrieve_local import LocalResearchRetriever
from src.agent.research.nodes.search import ResearchSearcher
from src.agent.research.nodes.query_rewrite import QueryRewriter
from src.agent.research.nodes.source_ranker import SourceRanker
from src.agent.research.nodes.synthesize import ResearchSynthesizer
from src.agent.research.nodes.understand import QueryUnderstandingNode
from src.agent.research.state import ResearchState

MAX_RESEARCH_ITERATIONS = 3


class ResearchGraph:
    def __init__(
        self,
        planner: ResearchPlanner | None = None,
        searcher: ResearchSearcher | None = None,
        extractor: EvidenceExtractor | None = None,
        evaluator: ResearchEvaluator | None = None,
        local_retriever: LocalResearchRetriever | None = None,
        synthesizer: ResearchSynthesizer | None = None,
        understander: QueryUnderstandingNode | None = None,
        query_rewriter: QueryRewriter | None = None,
        source_ranker: SourceRanker | None = None,
    ):
        isolated_test = planner is not None
        self.understander = understander or QueryUnderstandingNode(
            client=False if isolated_test else None
        )
        self.planner = planner or ResearchPlanner()
        self.query_rewriter = query_rewriter or QueryRewriter(
            client=False if isolated_test else None
        )
        self.searcher = searcher or ResearchSearcher()
        self.extractor = extractor or EvidenceExtractor()
        self.evaluator = evaluator or ResearchEvaluator()
        self.local_retriever = local_retriever or LocalResearchRetriever()
        self.source_ranker = source_ranker or SourceRanker()
        self.synthesizer = synthesizer or ResearchSynthesizer()

    async def run(self, state: ResearchState) -> ResearchState:
        """The remaining research phases are composed here incrementally."""
        from src.agent.research.nodes.extract import extract_node
        from src.agent.research.nodes.evaluate import evaluate_node
        from src.agent.research.nodes.planner import planner_node
        from src.agent.research.nodes.query_rewrite import query_rewrite_node
        from src.agent.research.nodes.retrieve_local import retrieve_local_node
        from src.agent.research.nodes.search import search_node
        from src.agent.research.nodes.source_ranker import source_ranker_node
        from src.agent.research.nodes.synthesize import synthesize_node
        from src.agent.research.nodes.understand import understand_node

        await understand_node(state, self.understander)
        await planner_node(state, self.planner)
        await query_rewrite_node(state, self.query_rewriter)
        await asyncio.gather(
            search_node(state, self.searcher),
            retrieve_local_node(state, self.local_retriever),
        )
        await source_ranker_node(state, self.source_ranker)
        await extract_node(state, self.extractor)
        await evaluate_node(state, self.evaluator)

        while not state.enough_evidence and state.iteration < MAX_RESEARCH_ITERATIONS:
            follow_up_map = self.evaluator.follow_up_query_map(state)
            if not follow_up_map:
                break
            state.search_queries = list(follow_up_map)
            state.query_question_map.update(follow_up_map)
            previous_iteration = state.iteration
            await search_node(state, self.searcher)
            if state.iteration == previous_iteration:
                break
            await source_ranker_node(state, self.source_ranker)
            await extract_node(state, self.extractor)
            await evaluate_node(state, self.evaluator)
        return await synthesize_node(state, self.synthesizer)


research_graph = ResearchGraph()
