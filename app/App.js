import React, {Component} from 'react'
import {
  Platform,
  View,
  TouchableOpacity
} from 'react-native'
import {
  Container,
  Header,
  Title,
  Content,
  Button,
  Left,
  Right,
  Body,
  Icon,
  Drawer
} from 'native-base'

import DropboxNoteList from './views/DropboxNoteList'

import SideBar from './components/SideBar'
import NoteModal from './views/note/NoteModal'
import NoteListItem from './components/NoteList/NoteListItem'
import styles from './AppStyle'

import AwsMobileAnalyticsConfig from './lib/AwsMobileAnalytics'
import { makeRandomHex } from './lib/Strings'

import RNFetchBlob from 'react-native-fetch-blob'
const fs = RNFetchBlob.fs
const dirs = RNFetchBlob.fs.dirs

const MARKDOWN_NOTE = 'MARKDOWN_NOTE'
// const SNIPPET_NOTE = 'SNIPPET_NOTE'
const DEFAULT_FOLDER = 'DEFAULT_FOLDER'

const HeaderLeft = ({openDrawer}) => (
  <Left>
    <View>
      <Button transparent onPress={openDrawer}>
        <Icon name='md-reorder' style={styles.headerMenuButton} />
      </Button>
    </View>
  </Left>
)

const HeaderBody = ({mode}) => (
  <Body>
    <View>
      <Title style={Platform.OS === 'android' ? styles.androidAppName : styles.iOsAppName}>
        {
          mode === 0
            ? 'All Notes'
            : 'Dropbox'
        }
      </Title>
    </View>
  </Body>
)

const HeaderRight = ({onFilterFavorites, filterFavorites}) => (
  <Right>
    <View>
      <TouchableOpacity onPress={onFilterFavorites}>
        <Icon name={filterFavorites ? 'md-star' : 'md-star-outline'}
          style={styles.headerRightMenuButton} />
      </TouchableOpacity>
    </View>
  </Right>
)

const NoteList = ({noteList, filterFavorites, onStarPress, setNoteModalIsOpen}) => (
  <Content contentContainerStyle={{ display: 'flex' }}>
    {
      noteList.map((note) => {
        if (filterFavorites && !note.isStarred) return null
        return <NoteListItem
          note={note}
          onStarPress={onStarPress}
          onNotePress={setNoteModalIsOpen}
          key={note.fileName} />
      })
    }
  </Content>
)

const CreateNewNoteButton = ({onPressActionButton}) => (
  <Button
    transparent
    onPress={() => onPressActionButton()}
    style={styles.newPostButtonWrap}>
    <View style={styles.newPostButton}>
      <Icon name='md-add' style={{color: '#fff'}} />
    </View>
  </Button>
)

export default class App extends Component {
  constructor () {
    super()
    this.state = {
      isNoteOpen: false,
      mode: 0, // 0: 'AllNote', 1: 'Dropbox'
      noteList: [],
      fileName: '',
      content: '',
      filterFavorites: false,
      isConnectedToDropbox: false
    }

    // Init AwsMobileAnalytics
    AwsMobileAnalyticsConfig.initAwsMobileAnalytics()

    this.openDrawer = this.openDrawer.bind(this)
    this.closeDrawer = this.closeDrawer.bind(this)
    this.setNoteModalIsOpen = this.setNoteModalIsOpen.bind(this)
    this.onStarPress = this.onStarPress.bind(this)
    this.listDir = this.listDir.bind(this)
    this.listFiles = this.listFiles.bind(this)
    this.listFilesAndSetState = this.listFilesAndSetState.bind(this)
    this.createDir = this.createDir.bind(this)
    this.createNewNote = this.createNewNote.bind(this)
    this.changeMode = this.changeMode.bind(this)
    this.onFilterFavorites = this.onFilterFavorites.bind(this)
    this.onPressActionButton = this.onPressActionButton.bind(this)
  }

  componentWillMount () {
    this.listDir(dirs.DocumentDir)
      .then((files) => {
        // Check whether the 'Boostnote' folder exist or not.
        const filteredFiles = files.filter((name) => {
          return name === 'Boostnote'
        })
        // If not, create.
        if (filteredFiles.length === 0) {
          this.createDir()
        }
        return this.listFiles()
      })
      .then((files) => {
        const filteredFiles = files.filter((name) => {
          return name === 'boostnote.json'
        })
        // Check whether the folder has a setting file or not.
        if (filteredFiles.length === 0) {
          // If not, create.
          const defaultJson = {
            note: []
          }
          fs.createFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, JSON.stringify(defaultJson), 'utf8')
            .catch(err => console.log(err))
        }
        return this.listFiles()
      })
      .then((files) => {
        const filteredFiles = files.filter((name) => {
          return name.endsWith('.md')
        })
        // Check whether the folder has any note files or not.
        if (filteredFiles.length === 0) {
          // If not, create.
          this.createNewNote(`${makeRandomHex()}.md`)
        }
        return this.listFilesAndSetState()
      })
      .catch((err) => {
        console.log(err)
      })
  }

  openDrawer () {
    this._drawer._root.open()
  }

  closeDrawer () {
    this._drawer._root.close()
  }

  setNoteModalIsOpen (fileName, isOpen) {
    if (isOpen) {
      fs.readFile(`${dirs.DocumentDir}/Boostnote/${fileName}`, 'utf8')
        .then((content) => {
          this.setState({
            fileName: fileName,
            content: content,
            isNoteOpen: true
          })
        })
    } else {
      AwsMobileAnalyticsConfig.recordDynamicCustomEvent('EDIT_NOTE')
      this.listFilesAndSetState()
      this.setState({
        isNoteOpen: false
      })
    }
  }

  onStarPress (fileName) {
    fs.readFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, 'utf8')
      .then((content) => {
        const contentObject = JSON.parse(content)
        const newNotes = []
        for (let i in contentObject.note) {
          const newNote = {...contentObject.note[i]}
          if (newNote.name === fileName) {
            newNote.isStarred = !newNote.isStarred
          }
          newNotes.push(newNote)
        }
        contentObject.note = newNotes
        fs.writeFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, JSON.stringify(contentObject), 'utf8')
          .then(this.listFilesAndSetState)
          .catch(err => console.log(err))
      })
      .catch((err) => {
        console.log(err)
      })
  }

  onFilterFavorites () {
    this.setState((prevState, props) => {
      return {filterFavorites: !prevState.filterFavorites}
    })
  }

  listDir () {
    return RNFetchBlob.fs.ls(`${dirs.DocumentDir}`)
  }

  listFiles () {
    return RNFetchBlob.fs.ls(`${dirs.DocumentDir}/Boostnote`)
  }

  async listFilesAndSetState () {
    const files = await this.listFiles()
    const filteredFiles = files.filter((name) => {
      return name.endsWith('.md')
    })

    const settingJsonFile = await fs.readFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, 'utf8')

    // Change file name to object of file name and one liner content
    const fileList = []
    for (let i = 0; i < filteredFiles.length; i++) {
      const fileName = filteredFiles[i]
      const content = await fs.readFile(`${dirs.DocumentDir}/Boostnote/${fileName}`, 'utf8')
      const filteredSettingFile = JSON.parse(settingJsonFile).note.filter(setting => {
        return setting.name === fileName
      })[0]
      fileList.push({
        fileName: fileName,
        content: content === '' ? 'Tap here and write something!' : content.split(/\r\n|\r|\n/)[0],
        createdAt: filteredSettingFile.createdAt,
        isStarred: filteredSettingFile.isStarred,
        updatedAt: filteredSettingFile.updatedAt,
      })
    }
    fileList.sort((a, b) => {
      return a.createdAt < b.createdAt ? 1 : -1
    })

    this.setState({
      noteList: fileList
    })
  }

  createDir () {
    RNFetchBlob.fs.mkdir(`${dirs.DocumentDir}/Boostnote`)
      .then(() => {
        console.log('OK')
      })
      .catch(() => {
        console.log('NG')
      })
  }

  createNewNote (fileName, isOpen) {
    const newFileName = fileName === '' ? `${makeRandomHex()}.md` : fileName

    // Create a real file
    fs.createFile(`${dirs.DocumentDir}/Boostnote/${newFileName}`, '', 'utf8')
      .then((file) => {
        this.setState({
          isNoteOpen: isOpen,
          fileName: newFileName,
          content: ''
        })
        // Update setting file
        return fs.readFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, 'utf8')
      })
      .then((content) => {
        const contentObject = JSON.parse(content)
        const date = new Date()
        const thisNote = {
          'type': MARKDOWN_NOTE,
          'folder': DEFAULT_FOLDER,
          'title': '',
          'name': newFileName,
          'isStarred': false,
          'createdAt': date,
          'updatedAt': date
        }
        contentObject.note.push(thisNote)
        fs.writeFile(`${dirs.DocumentDir}/Boostnote/boostnote.json`, JSON.stringify(contentObject), 'utf8')
          .catch(err => console.log(err))
        AwsMobileAnalyticsConfig.recordDynamicCustomEvent('CREATE_NOTE')
      })
      .catch((err) => {
        console.log(err)
      })
  }

  changeMode (mode) {
    this.setState({
      mode: mode
    })
  }

  onPressActionButton () {
    if (this.state.mode === 0) {
      this.createNewNote('', true)
    } else if (this.state.mode === 1) {
      this.refs.dropboxNoteList.createNewNote()
    }
  }

  setIsConnectedToDropbox (value) {
    this.setState({
      isConnectedToDropbox: value
    })
  }

  render () {
    const { noteList, mode, filterFavorites, isNoteOpen, fileName, content, isConnectedToDropbox } = this.state
    return (
      <Drawer
        ref={(ref) => {
          this._drawer = ref
        }}
        content={
          <SideBar
            changeMode={this.changeMode}
            onClose={() => this.closeDrawer()} />
        }
        panOpenMask={0.05}>
        <Container>
          <Header style={Platform.OS === 'android' ? styles.androidHeader : styles.iosHeader} androidStatusBarColor='#239F85'>
            <HeaderLeft openDrawer={this.openDrawer} />
            <HeaderBody mode={mode} />
            <HeaderRight onFilterFavorites={this.onFilterFavorites}
              filterFavorites={filterFavorites} />
          </Header>
          {
            mode === 0
              ? <NoteList noteList={noteList}
                filterFavorite={filterFavorites}
                onStarPress={this.onStarPress}
                setNoteModalIsOpen={this.setNoteModalIsOpen} />
              : <DropboxNoteList ref='dropboxNoteList'
                isConnectedToDropbox={isConnectedToDropbox}
                setIsConnectedToDropbox={this.setIsConnectedToDropbox.bind(this)} />
          }
        </Container>
        <View>
          {
            mode === 1 && !isConnectedToDropbox
              ? null
              : <CreateNewNoteButton onPressActionButton={this.onPressActionButton} />
          }
          <NoteModal setIsOpen={this.setNoteModalIsOpen}
            isNoteOpen={isNoteOpen}
            fileName={fileName}
            content={content} />
        </View>
      </Drawer>
    )
  }
}
