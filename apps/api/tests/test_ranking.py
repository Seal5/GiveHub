from dataclasses import dataclass

from givehub.ranking import fair_organisation_rotation


@dataclass(frozen=True)
class Result:
    name: str
    organisation: str
    cohort: int


def test_fair_rotation_interleaves_hosts_within_a_comparable_cohort() -> None:
    results = [
        Result("Large 1", "Large host", 0),
        Result("Large 2", "Large host", 0),
        Result("Small 1", "Small host", 0),
        Result("Large 3", "Large host", 0),
        Result("Community 1", "Community host", 0),
    ]

    ranked = fair_organisation_rotation(
        results,
        cohort_key=lambda item: item.cohort,
        organisation_key=lambda item: item.organisation,
    )

    assert [item.name for item in ranked] == [
        "Large 1",
        "Small 1",
        "Community 1",
        "Large 2",
        "Large 3",
    ]


def test_fair_rotation_never_crosses_relevance_cohorts() -> None:
    results = [
        Result("Nearby 1", "Large host", 0),
        Result("Nearby 2", "Large host", 0),
        Result("Farther 1", "Small host", 1),
        Result("Farther 2", "Community host", 1),
    ]

    ranked = fair_organisation_rotation(
        results,
        cohort_key=lambda item: item.cohort,
        organisation_key=lambda item: item.organisation,
    )

    assert [item.cohort for item in ranked] == [0, 0, 1, 1]
    assert [item.name for item in ranked[:2]] == ["Nearby 1", "Nearby 2"]
