Setting['rest_api_enabled'] = '1'

u = User.find_by_login('admin')
Token.where(user_id: u.id, action: 'api').destroy_all
token = Token.create!(user: u, action: 'api')
puts "API_KEY=#{token.value}"

proj = Project.find_by_identifier('cloud-hmi')
proj.trackers = Tracker.all.to_a
proj.save!

tracker = proj.trackers.first || Tracker.first
status = IssueStatus.where(is_closed: false).first
priority = IssuePriority.default || IssuePriority.first

puts "PROJECT_TRACKERS=#{proj.trackers.map(&:name).join(',')}"

Issue.delete_all
3.times do |i|
  issue = Issue.new(
    project: proj,
    tracker: tracker,
    author: u,
    assigned_to: u,
    subject: "Seed issue #{i + 1}",
    description: "Integration test issue #{i + 1}",
    status: status,
    priority: priority
  )
  issue.save!
  puts "CREATED=#{issue.id}"
end

puts "ISSUE_COUNT=#{Issue.count}"
puts "ISSUE_IDS=#{Issue.pluck(:id).join(',')}"
