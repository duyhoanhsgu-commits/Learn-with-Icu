__all__ = ["agent_graph"]


def __getattr__(name: str):
    if name == "agent_graph":
        from src.agent.graph import agent_graph

        return agent_graph
    raise AttributeError(name)
