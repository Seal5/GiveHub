from collections import OrderedDict, deque
from collections.abc import Callable, Hashable, Sequence


def fair_organisation_rotation[Item](
    items: Sequence[Item],
    *,
    cohort_key: Callable[[Item], Hashable],
    organisation_key: Callable[[Item], Hashable],
) -> list[Item]:
    """Interleave hosts only among opportunities with comparable relevance.

    Cohorts retain their first-seen order, and each host's own listings retain
    their original order. This keeps the ranking deterministic while stopping
    a prolific host from occupying every position in a comparable result set.
    """
    cohorts: OrderedDict[Hashable, list[Item]] = OrderedDict()
    for item in items:
        cohorts.setdefault(cohort_key(item), []).append(item)

    ranked: list[Item] = []
    for cohort in cohorts.values():
        host_queues: OrderedDict[Hashable, deque[Item]] = OrderedDict()
        for item in cohort:
            host_queues.setdefault(organisation_key(item), deque()).append(item)
        while host_queues:
            for host in list(host_queues):
                queue = host_queues[host]
                ranked.append(queue.popleft())
                if not queue:
                    del host_queues[host]
    return ranked
