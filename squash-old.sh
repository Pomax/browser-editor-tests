cd content

GIT_EDITOR="nano"
GIT_SEQUENCE_EDITOR="nano"
BRANCH=$(git branch --show-current)
FIRST=$(git rev-list --max-parents=0 HEAD)
KEEP=$(git log --pretty=format:"%H" --before="yesterday" -1)

if [[ ! -z "${KEEP}" ]]; then
echo "${BRANCH} ${FIRST} ${KEEP}"
git checkout ${KEEP}
git reset --soft ${FIRST}
git commit --ammend --allow-empty-commit
git tag historycollapse
git checkout ${BRANCH}
git rebase --onto historycollapse ${KEEP}
git tag -d historycollapse
else
echo "no commits older than a day found"
fi
