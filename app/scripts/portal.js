
class Portal {
  constructor(rotonde, url) {
    this.rotonde = rotonde
    this.url = url

    this.data = {}
    this.icon = ''
  }

  async start() {
    this.hash = await resolveDatUrl(this.url)
    this.url = 'dat://' + this.hash + '/'
    
    fs.ensureDirSync(path.join(os.tmpdir(), 'lu-rotonde-app', this.hash))
    
    this.dat = await Dat(path.join(os.tmpdir(), 'lu-rotonde-app', this.hash), {
      key: this.url
    })

    this.dat.joinNetwork()

    this.activity = emitStream(pda.createFileActivityStream(this.dat.archive))
    this.activity.on('change', this.onChange.bind(this))

    this.onChange()

    return true
  }

  async onChange() {
    try {
      this.icon = await pda.readFile(this.dat.archive, 'media/content/icon.svg') || ''
    } catch(e) {}

    try {
      var data = await pda.readFile(this.dat.archive, 'portal.json')
      
      this.data = JSON.parse(data)
    } catch(e) {
      console.log(e)
      // give some kind of error notification here
    }

    this.rotonde.updatePortals()

    this.rotonde.updateFeed()
  }

  async getFeed() {
    if (!this.data || !this.data.feed) return [];

    var feed = []
    var psl = []
    this.data.feed.forEach((entry) => {
      var ps = this.rotonde.createFeedEntry(this, entry)
        .then(entry => {
          feed.push(entry)
        })
      psl.push(ps)
    })

    //console.log('waiting feed for ' + this.data.name)

    await Promise.all(psl)

    //console.log('got feed for ' + this.data.name)

    //console.log(feed)

    return feed
  }
}